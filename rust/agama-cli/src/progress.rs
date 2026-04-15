// Copyright (c) [2024-2025] SUSE LLC
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

use std::collections::HashMap;

use agama_lib::{
    http::{BaseHTTPClient, WebSocketClient},
    monitor::{InstallationStatus, Monitor, MonitorClient},
};
use agama_utils::api::{self, question::Question, status::Stage, IssueWithScope, Scope};
use gettextrs::gettext;
use indicatif::{MultiProgress, ProgressBar, ProgressStyle};

/// Displays the progress on the terminal.
#[derive(Debug)]
pub struct ProgressMonitor {
    /// The current installation status.
    state: InstallationStatus,
    /// Whether to stop monitoring when Agama becomes idle.
    stop_on_idle: bool,
    /// The main progress bar container.
    progress_bar: Option<MultiProgress>,
    /// A map of progress bars for each scope.
    progresses: HashMap<Scope, (ProgressBar, ProgressBar)>,
    /// The client to communicate with the monitor task.
    monitor: MonitorClient,
}

impl ProgressMonitor {
    /// Starts the CLI representing the progress.
    ///
    /// # Arguments
    ///
    /// * `http_client`: The HTTP client to communicate with the Agama service.
    /// * `websocket`: The WebSocket client to listen for events.
    /// * `stop_on_idle`: Whether to stop monitoring when Agama becomes idle.
    pub async fn run(
        http_client: BaseHTTPClient,
        websocket: WebSocketClient,
        stop_on_idle: bool,
    ) -> anyhow::Result<()> {
        let monitor = Monitor::connect(websocket, &http_client).await?;
        let state = monitor.get_installation_status().await?;
        let mut progress_monitor = Self {
            state,
            stop_on_idle,
            progress_bar: None,
            progresses: HashMap::new(),
            monitor,
        };

        if !progress_monitor.render_state().await? {
            return Ok(());
        }

        progress_monitor.loop_monitor().await?;

        Ok(())
    }

    /// Renders the current state of the installation progress.
    async fn render_state(&mut self) -> anyhow::Result<bool> {
        // clear progresses to not interfere with new state
        if let Some(main) = &self.progress_bar {
            for (p1, p2) in self.progresses.values() {
                p1.finish_and_clear();
                main.remove(p1);
                p2.finish_and_clear();
                main.remove(p2);
            }
            // if clearing failed, just ignore it, following terminal clear should handle it
            let _ = main.clear();
        }

        // clear also internal references
        self.progresses.clear();
        self.progress_bar = None;

        // and whole terminal
        Self::clear_terminal();

        // if there is any unaswered question, it has precedence as it affects everything else
        let questions = &self.state.questions;
        if !questions.is_empty() {
            self.print_questions(questions).await?;
            return Ok(true);
        }

        let status = &self.state.status;
        // if we end installation, then just finish with some nice message
        if status.stage.is_end() {
            Self::print_final_status(status);
            return Ok(false);
        }
        let progresses = &status.progresses;
        // if there are some progress, then it has precedence over issues as it can solve them
        if !progresses.is_empty() {
            let multibar = MultiProgress::new();
            let message = if status.stage == Stage::Configuring {
                gettext("Calculating proposal:")
            } else {
                gettext("Installing target system:")
            };
            multibar.println(message)?;
            multibar.println("")?;

            for progress in progresses {
                let bars = Self::create_progress_bar(&multibar, progress);
                self.progresses.insert(progress.scope, bars);
            }
            self.progress_bar = Some(multibar);
            return Ok(true);
        }

        // if we configuring and there are some issue, print it and wait for user to fix it
        if status.stage == Stage::Configuring {
            let issues = &self.state.issues;
            if !issues.is_empty() {
                Self::print_issues(issues)?;
                return Ok(true);
            }
        }

        Self::print_stage(&status.stage);
        Ok(!self.stop_on_idle)
    }

    /// Listens for updates from the monitor and updates the progress display.
    async fn loop_monitor(&mut self) -> anyhow::Result<()> {
        let mut receiver = self.monitor.subscribe();
        loop {
            let new_state = receiver.recv().await;
            let Ok(Ok(new_state)) = new_state else {
                return Err(anyhow::Error::msg("Communication with backend failed"));
            };

            // lets first check if there is update in questions
            // if so, we need to redraw screen
            if self.state.questions != new_state.questions {
                self.state = new_state;
                if !self.render_state().await? {
                    break;
                }
                continue;
            }

            // then check update of progresses
            if self.state.status.progresses != new_state.status.progresses {
                self.state = new_state;
                // no progress remaining, so just redraw screen
                if self.state.status.progresses.is_empty() {
                    if self.render_state().await? {
                        continue;
                    } else {
                        break;
                    }
                }
                if let Some(main_bar) = &self.progress_bar {
                    for progress in &self.state.status.progresses {
                        if let Some((bar1, bar2)) = self.progresses.get(&progress.scope) {
                            bar1.set_position(progress.index as u64);
                            bar1.set_message(progress.step.clone());
                            bar2.set_position(progress.index as u64);
                            bar2.set_message(progress.step.clone());
                        } else {
                            let bars = Self::create_progress_bar(main_bar, progress);
                            self.progresses.insert(progress.scope, bars);
                        }
                    }
                // there are no multi progress, so no progress before and we should redraw
                } else if !self.render_state().await? {
                    break;
                }
                continue;
            }

            // remaining cases like change of issues or stage will all result in redrawing
            if self.state != new_state {
                self.state = new_state;
                if !self.render_state().await? {
                    break;
                }
            }
        }

        Ok(())
    }

    /// Prints the current installation stage.
    fn print_stage(stage: &Stage) {
        match stage {
            Stage::Configuring => println!("{}", gettext("Installation is ready to start.")),
            // installaling without progress means that it probably do not
            // start yet, should be almost invisible blink
            Stage::Installing => println!("{}", gettext("Waiting to start installation")),
            _ => unreachable!(),
        }
    }

    /// Prints the final installation status.
    fn print_final_status(status: &api::Status) {
        match status.stage {
            Stage::Finished => println!("{}", gettext("Installation successfully finished")),
            Stage::Failed => println!("{}", gettext("Installation failed")),
            _ => unreachable!(),
        }
    }

    /// Clears the terminal screen.
    fn clear_terminal() {
        // ignore failure of screen clearing, as it not critical
        let _ = console::Term::stdout().clear_screen();
    }

    /// Prints any unanswered questions.
    async fn print_questions(&self, questions: &Vec<Question>) -> anyhow::Result<()> {
        println!("{}", gettext("There are unanswered questions. Please use `agama questions` command or web interface to answer them:"));
        for q in questions {
            // Should we also print question class?
            println!("  - {}", q.spec.text);
        }
        Ok(())
    }

    /// Prints any issues blocking the installation.
    fn print_issues(issues: &Vec<IssueWithScope>) -> anyhow::Result<()> {
        println!("{}", gettext("Installer is preparing target configuration. But there are issues blocking installation:"));

        let mut grouped: HashMap<&Scope, Vec<&api::Issue>> = HashMap::new();
        for i in issues {
            grouped.entry(&i.scope).or_default().push(&i.issue);
        }

        for (scope, issues) in grouped {
            println!("\n{}:", Self::scope_to_string(scope));
            for issue in issues {
                println!("  - {}", issue.description);
                if let Some(details) = &issue.details {
                    println!("    {}: {}", gettext("Details"), details);
                }
            }
        }
        Ok(())
    }

    /// Converts a `Scope` enum to a human-readable string.
    fn scope_to_string(scope: &Scope) -> String {
        match scope {
            Scope::Manager => gettext("Manager"),
            Scope::Network => gettext("Network"),
            Scope::Hostname => gettext("Hostname"),
            Scope::L10n => gettext("Localization"),
            Scope::Product => gettext("Product"),
            Scope::Software => gettext("Software"),
            Scope::Storage => gettext("Storage"),
            Scope::Files => gettext("Files"),
            Scope::ISCSI => gettext("iSCSI"),
            Scope::DASD => gettext("DASD"),
            Scope::ZFCP => gettext("zFCP"),
            Scope::Users => gettext("Users"),
        }
    }

    /// Creates and configures a new progress bar.
    fn create_progress_bar(
        multibar: &MultiProgress,
        progress: &api::Progress,
    ) -> (ProgressBar, ProgressBar) {
        let bar1 = multibar.add(ProgressBar::new(progress.size as u64));
        let bar2 = multibar.add(ProgressBar::new(progress.size as u64));
        let (template1, template2) = if progress.scope == Scope::Manager {
            (
                format!(
                    "{} ({{pos:>2}}/{{len:2}}): {{wide_msg}}",
                    gettext("Current step")
                ),
                "".to_string(), // just separate main progress and subprogress
            )
        } else {
            (
                "{wide_bar:40.green}".to_string(),
                "{pos:>5}/{len:5} {wide_msg}".to_string(),
            )
        };
        // unwrap is safe as we created the style ( hope rust can do compile time check in future )
        bar1.set_style(ProgressStyle::with_template(&template1).unwrap());
        bar2.set_style(ProgressStyle::with_template(&template2).unwrap());
        bar1.set_position(progress.index as u64);
        bar1.set_message(progress.step.clone());
        bar2.set_position(progress.index as u64);
        bar2.set_message(progress.step.clone());
        (bar1, bar2)
    }
}
