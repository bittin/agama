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

//! This module implements a monitor that keeps track of Agama service status.
//!
//! The monitor tracks:
//!
//! * Changes in the installer status (see [api::Status]).
//!
//! Each time the installer status changes, it sends the new status using the
//! [api::Status] struct.
//!
//!
//! ```no_run
//!   # use agama_lib::{monitor::Monitor, auth::AuthToken, http::{BaseHTTPClient, WebSocketClient}};
//!
//!   async fn print_status(http_url: url::Url, ws_url: url::Url, token: AuthToken) -> anyhow::Result<()> {
//!     let http_client = BaseHTTPClient::new(http_url)?
//!       .authenticated(&token)?;
//!     let ws_client = WebSocketClient::connect(&ws_url, &token, false)
//!       .await?;
//!     let monitor = Monitor::connect(http_client, ws_client).await.unwrap();
//!     let mut updates = monitor.subscribe();
//!
//!     loop {
//!       if let Ok(status) = updates.recv().await {
//!           println!("Status: {:?}", &status.stage);
//!       }
//!     }
//!  }
//! ```
//!

use agama_utils::api::{self, Event};
use tokio::sync::{mpsc, oneshot, Mutex};

use crate::http::{BaseHTTPClientError, WebSocketClient, WebSocketError};

#[derive(thiserror::Error, Debug)]
pub enum MonitorError {
    #[error("Error connecting to the HTTP API: {0}")]
    HTTP(#[from] BaseHTTPClientError),
    #[error("WebSocket error: {0}")]
    WebSocket(#[from] WebSocketError),
    #[error(transparent)]
    Url(#[from] url::ParseError),
    #[error("Error receiving the monitor message: {0}")]
    Recv(#[from] oneshot::error::RecvError),
    #[error("Error sending the monitor message: {0}")]
    Send(#[from] tokio::sync::mpsc::error::SendError<MonitorCommand>),
}

/// It allows connecting to the Agama monitor to get the status or listen for changes.
///
/// It can be cloned and moved between threads.
#[derive(Clone, Debug)]
pub struct MonitorClient {
    commands: mpsc::Sender<MonitorCommand>,
}

impl MonitorClient {
    /// Returns and clear the last event or none if no event was there from previous call.
    pub async fn pop_last_event(&self) -> Result<Option<Event>, MonitorError> {
        let (tx, rx) = tokio::sync::oneshot::channel();
        self.commands.send(MonitorCommand::LastEvent(tx)).await?;
        Ok(rx.await??)
    }
}

/// Monitors an Agama websocket and keeps track of the last event related to monitor.
/// NOTE: it is highly coupled with monitor CLI and it knows which events cause redraw
/// and which just update screen. So it returns event that overwrite screen or the
/// last one which update screen.
pub struct Monitor {
    // Channel to receive commands.
    commands: mpsc::Receiver<MonitorCommand>,
    ws_client: WebSocketClient,
    // mutex is needed to avoid race conditions
    // Result is needed to be able to report problems with socket
    // and last but not least option is needed as there can be no event between calls
    last_event: Mutex<Result<Option<Event>, WebSocketError>>,
}

#[derive(Debug)]
pub enum MonitorCommand {
    LastEvent(tokio::sync::oneshot::Sender<Result<Option<api::Event>, WebSocketError>>),
}

impl Monitor {
    /// Connects and monitors to an Agama service.
    ///
    /// * `http_client`: HTTP client to talk to the service.
    /// * `websocket_client`: websocket to listen for events.
    ///
    /// The monitor runs on a separate Tokio task.
    pub async fn connect(websocket_client: WebSocketClient) -> Result<MonitorClient, MonitorError> {
        // Channel to send/receive commands from the client.
        let (commands_tx, commands_rx) = mpsc::channel(16);
        let client = MonitorClient {
            commands: commands_tx,
        };

        let mut monitor = Monitor {
            commands: commands_rx,
            ws_client: websocket_client,
            last_event: Mutex::new(Ok(None)),
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
            MonitorCommand::LastEvent(channel) => {
                let mut g = self.last_event.lock().await;
                let e = std::mem::replace(&mut *g, Ok(None));
                let _ = channel.send(e);
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
        let Ok(event) = event else {
            let mut g = self.last_event.lock().await;
            *g = Err(event.unwrap_err());
            return;
        };

        // store only events that are important for monitor
        if matches!(
            event,
            Event::ProgressFinished { .. }
                | Event::IssuesChanged { .. }
                | Event::StageChanged { .. }
                | Event::ProgressChanged { .. }
                | Event::QuestionAdded { .. }
                | Event::QuestionAnswered { .. }
        ) {
            let mut g = self.last_event.lock().await;
            // tricky part. With approach of overriding the last event we need to prioritize ones that do
            // redraw over ones that just update field, otherwise we can loose redraw event cause some issues
            if g.as_ref().is_ok_and(|e| {
                e.is_none()
                    || e.as_ref()
                        .is_some_and(|f| matches!(f, Event::ProgressChanged { .. }))
            }) {
                *g = Ok(Some(event));
            }
        }
    }
}
