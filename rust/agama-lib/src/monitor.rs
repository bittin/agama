// Copyright (c) [2025] SUSE LLC
//
// All Rights Reserved.
//
// This program is free software; you can redistribute it and/or modify it
// under the terms of the GNU General Public License as published by the Free
// Software Foundation; either version 2 of the License, or (at your option)
// any later version.
//
// This program is distributed in the hope that it will be useful, but WITHOUT
// ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
// FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for
// more details.
//
// You should have received a copy of the GNU General Public License along
// with this program; if not, contact SUSE LLC.
//
// To contact SUSE LLC about this file by physical or electronic mail, you may
// find current contact information at www.suse.com.

//! This module implements a monitor that listens to Agama events and keeps an updated
//! representation of the installation status, issues, and questions.
//!
//! It provides a [`MonitorClient`] that can be used to query the current status or subscribe
//! to updates via a broadcast channel.
//!
//! # Example
//!
//! ```no_run
//! use agama_lib::http::{BaseHTTPClient, WebSocketClient};
//! use agama_lib::monitor::Monitor;
//! use agama_lib::auth::AuthToken;
//! use url::Url;
//!
//! # async fn run() -> anyhow::Result<()> {
//! let http_client = BaseHTTPClient::new("http://localhost/api/")?;
//! let url = Url::parse("http://localhost/ws")?;
//! let token = AuthToken::new("token");
//! let ws_client = WebSocketClient::connect(&url, &token, false).await?;
//!
//! // Connect the monitor (this spawns a background task)
//! let monitor_client = Monitor::connect(ws_client, &http_client).await?;
//!
//! // Get the current installation status
//! let status = monitor_client.get_installation_status().await?;
//! println!("Current stage: {:?}", status.status.stage);
//!
//! // Subscribe to future updates
//! let mut rx = monitor_client.subscribe();
//! while let Ok(Ok(new_status)) = rx.recv().await {
//!     println!("Status updated! Issues count: {}", new_status.issues.len());
//! }
//! # Ok(())
//! # }
//! ```

use std::fmt;

use agama_utils::api::{self, Event};
use tokio::sync::{broadcast, mpsc, oneshot, Mutex};

use crate::{
    http::{BaseHTTPClient, WebSocketClient},
    manager::{http_client::ManagerHTTPClientError, ManagerHTTPClient},
    questions::{self, http_client::QuestionsHTTPClientError},
};

/// Errors that can occur when interacting with the monitor.
#[derive(thiserror::Error, Debug)]
pub enum MonitorError {
    /// Error connecting to the Manager HTTP API.
    #[error("Error connecting to the Manager HTTP API: {0}")]
    Manager(#[from] ManagerHTTPClientError),
    /// Error connecting to the Questions HTTP API.
    #[error("Error connecting to the Questions HTTP API: {0}")]
    Questions(#[from] QuestionsHTTPClientError),
    /// Error receiving a message from the monitor task.
    #[error("Error receiving the monitor message: {0}")]
    Recv(#[from] oneshot::error::RecvError),
    /// Error sending a command to the monitor task.
    #[error("Error sending the monitor message: {0}")]
    Send(#[from] tokio::sync::mpsc::error::SendError<MonitorCommand>),
    /// An error occurred in the monitor backend.
    #[error(transparent)]
    Backend(#[from] MonitorBackendError),
}

/// Represents an error occurring in the backend while monitoring the status.
#[derive(Debug, Clone, thiserror::Error)]
pub struct MonitorBackendError(String);

impl fmt::Display for MonitorBackendError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "Failed to obtain status in StatusMonitor: {}", self.0)
    }
}

/// Extended status information with combination of status, issues and questions
#[derive(Clone, Debug, PartialEq)]
pub struct InstallationStatus {
    /// Current installation status.
    pub status: api::Status,
    /// List of issues currently blocking or affecting the installation.
    pub issues: Vec<api::IssueWithScope>,
    /// List of unanswered questions.
    pub questions: Vec<api::question::Question>,
}

/// It allows connecting to the Agama monitor to get the status or listen for changes.
///
/// It can be cloned and moved between threads.
#[derive(Clone, Debug)]
pub struct MonitorClient {
    /// Channel to send commands to the monitor task.
    commands: mpsc::Sender<MonitorCommand>,
    /// Channel to subscribe to status updates.
    updates: broadcast::Sender<Result<InstallationStatus, MonitorBackendError>>,
}

impl MonitorClient {
    /// Returns the current installation status.
    pub async fn get_installation_status(&self) -> Result<InstallationStatus, MonitorError> {
        let (tx, rx) = tokio::sync::oneshot::channel();
        self.commands
            .send(MonitorCommand::GetInstallationStatus(tx))
            .await?;
        Ok(rx.await??)
    }

    /// Subscribe to status updates from the monitor.
    ///
    /// It uses a regular broadcast channel from the Tokio library.
    pub fn subscribe(
        &self,
    ) -> broadcast::Receiver<Result<InstallationStatus, MonitorBackendError>> {
        self.updates.subscribe()
    }
}

/// Monitors an Agama websocket and keeps combination of various installation statuses.
///
/// It can be cloned and moved between threads
pub struct Monitor {
    /// Channel to receive commands.
    commands: mpsc::Receiver<MonitorCommand>,
    /// WebSocket client to listen for events.
    ws_client: WebSocketClient,
    /// HTTP client to fetch additional data.
    http_client: BaseHTTPClient,
    /// The current installation status.
    ///
    /// A mutex is needed to avoid race conditions.
    /// Result is needed to be able to report problems with the socket.
    status: Mutex<Result<InstallationStatus, MonitorBackendError>>,
    /// Channel to broadcast status updates to subscribers.
    updates: broadcast::Sender<Result<InstallationStatus, MonitorBackendError>>,
}

/// Commands that can be sent to the monitor task.
#[derive(Debug)]
pub enum MonitorCommand {
    /// Command to request the current installation status.
    ///
    /// The monitor will send the status back through the provided oneshot channel.
    GetInstallationStatus(
        tokio::sync::oneshot::Sender<Result<InstallationStatus, MonitorBackendError>>,
    ),
}

impl Monitor {
    /// Connects and monitors to an Agama service.
    ///
    /// * `http_client`: HTTP client to talk to the service.
    /// * `websocket_client`: websocket to listen for events.
    ///
    /// The monitor runs on a separate Tokio task.
    pub async fn connect(
        websocket_client: WebSocketClient,
        http_client: &BaseHTTPClient,
    ) -> Result<MonitorClient, MonitorError> {
        // Channel to send/receive commands from the client.
        let (commands_tx, commands_rx) = mpsc::channel(16);
        let (updates, _rx) = broadcast::channel(16);
        let client = MonitorClient {
            commands: commands_tx,
            updates: updates.clone(),
        };
        let manager = ManagerHTTPClient::new(http_client.clone());
        let questions = questions::http_client::HTTPClient::new(http_client.clone());
        let questions = questions.get_questions().await?;
        let questions = questions
            .into_iter()
            .filter(|q| q.answer.is_none())
            .collect();

        let initial_status = InstallationStatus {
            status: manager.status().await?,
            issues: manager.issues().await?,
            questions,
        };

        let mut monitor = Monitor {
            commands: commands_rx,
            ws_client: websocket_client,
            http_client: http_client.clone(),
            status: Mutex::new(Ok(initial_status)),
            updates,
        };

        tokio::spawn(async move { monitor.run().await });
        Ok(client)
    }

    /// Runs the monitor.
    async fn run(&mut self) {
        loop {
            tokio::select! {
                Some(cmd) = self.commands.recv() => {
                    self.handle_command(cmd).await;
                }
                event = self.ws_client.receive() => {
                    self.handle_event(event).await;
                }
            }
        }
    }

    /// Handle commands from the client.
    ///
    /// * `command`: command to execute.
    async fn handle_command(&mut self, command: MonitorCommand) {
        match command {
            MonitorCommand::GetInstallationStatus(channel) => {
                let g = self.status.lock().await;
                let r = channel.send(g.clone());
                if r.is_err() {
                    tracing::error!("failed to send installation status {:?}", r);
                }
            }
        }
    }

    /// Handle events from Agama.
    ///
    /// Given an event, updates the internal state. Once updated, it emits
    /// sends the updated state to its subscribers.
    ///
    /// * `event`: Agama event.
    async fn handle_event(&mut self, event: Result<Event, crate::http::WebSocketError>) {
        let mut g = self.status.lock().await;
        let Ok(status) = g.as_mut() else {
            // we already errored, so just return
            return;
        };

        let Ok(event) = event else {
            *g = Err(MonitorBackendError(event.unwrap_err().to_string()));
            let _ = self.updates.send(g.clone());
            return;
        };

        // store only events that are important for monitor
        match event {
            Event::StageChanged { stage } => {
                status.status.stage = stage;
            }
            Event::IssuesChanged { .. } => {
                //TODO: we need better params when issues changed to be able to depend only on websocket
                let manager = ManagerHTTPClient::new(self.http_client.clone());
                let issues = manager.issues().await;
                let Ok(issues) = issues else {
                    tracing::error!("Failed to get list of issues: {:?}", issues);
                    return;
                };
                status.issues = issues;
            }
            Event::QuestionAdded { .. } => {
                //TODO: we need better params when question is added to be able to depend only on websocket
                let questions = questions::http_client::HTTPClient::new(self.http_client.clone());
                let questions = questions.get_questions().await;
                let Ok(questions) = questions else {
                    tracing::error!("Failed to get list of questions: {:?}", questions);
                    return;
                };
                let questions = questions
                    .into_iter()
                    .filter(|q| q.answer.is_none())
                    .collect();
                status.questions = questions;
            }
            Event::QuestionAnswered { id } => {
                status.questions.retain(|q| q.id != id);
            }
            Event::ProgressChanged { progress } => {
                let index = status
                    .status
                    .progresses
                    .iter()
                    .position(|p| p.scope == progress.scope);
                if let Some(index) = index {
                    status.status.progresses[index] = progress;
                } else {
                    status.status.progresses.push(progress);
                }
            }
            Event::ProgressFinished { scope } => {
                status.status.progresses.retain(|p| p.scope != scope);
            }
            _ => {
                // other events are not interesting for monitor
                return;
            }
        }

        // lets ignore if send failed, otherwise with progress updates we will have logs full quickly
        let _ = self.updates.send(g.clone());
    }
}
