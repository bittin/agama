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

//! This module implements a monitor that keeps last important event for monitor CLI.

use std::fmt;

use agama_utils::api::{self, Event};
use tokio::sync::{broadcast, mpsc, oneshot, Mutex};

use crate::{
    http::{BaseHTTPClient, WebSocketClient, WebSocketError},
    manager::{http_client::ManagerHTTPClientError, ManagerHTTPClient},
    questions::{self, http_client::QuestionsHTTPClientError},
};
#[derive(thiserror::Error, Debug)]
pub enum MonitorError {
    #[error("Error connecting to the Manager HTTP API: {0}")]
    Manager(#[from] ManagerHTTPClientError),
    #[error("Error connecting to the Questions HTTP API: {0}")]
    Questions(#[from] QuestionsHTTPClientError),
    #[error("WebSocket error: {0}")]
    WebSocket(#[from] WebSocketError),
    #[error(transparent)]
    Url(#[from] url::ParseError),
    #[error("Error receiving the monitor message: {0}")]
    Recv(#[from] oneshot::error::RecvError),
    #[error("Error sending the monitor message: {0}")]
    Send(#[from] tokio::sync::mpsc::error::SendError<MonitorCommand>),
    #[error(transparent)]
    Backend(#[from] MonitorBackendError),
}

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
    pub status: api::Status,
    pub issues: Vec<api::IssueWithScope>,
    pub questions: Vec<api::question::Question>,
}

/// It allows connecting to the Agama monitor to get the status or listen for changes.
///
/// It can be cloned and moved between threads.
#[derive(Clone, Debug)]
pub struct MonitorClient {
    commands: mpsc::Sender<MonitorCommand>,
    updates: broadcast::Sender<Result<InstallationStatus, MonitorBackendError>>,
}

impl MonitorClient {
    /// Returns and clear the last event or none if no event was there from previous call.
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
    // Channel to receive commands.
    commands: mpsc::Receiver<MonitorCommand>,
    ws_client: WebSocketClient,
    http_client: BaseHTTPClient,
    // mutex is needed to avoid race conditions
    // Result is needed to be able to report problems with socket
    status: Mutex<Result<InstallationStatus, MonitorBackendError>>,
    updates: broadcast::Sender<Result<InstallationStatus, MonitorBackendError>>,
}

#[derive(Debug)]
pub enum MonitorCommand {
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
    async fn handle_event(&mut self, event: Result<Event, WebSocketError>) {
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
