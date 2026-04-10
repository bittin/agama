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

use std::{collections::HashMap, thread::sleep, time::Duration};

use agama_lib::{
    http::{BaseHTTPClient, WebSocketClient},
    manager::ManagerHTTPClient,
    monitor::Monitor,
    questions,
};
use agama_utils::api::{self, question::Question, status::Stage, IssueWithScope, Scope};
use gettextrs::gettext;
use indicatif::{MultiProgress, ProgressBar, ProgressStyle};

/// Displays the progress on the terminal.
#[derive(Debug)]
pub struct ProgressMonitor {
    http_client: BaseHTTPClient,
    stop_on_idle: bool,
    progress_bar: Option<MultiProgress>,
    progresses: HashMap<Scope, ProgressBar>,
}

impl ProgressMonitor {
    /// Starts the CLI representing the progress.
    pub async fn run(
        http_client: BaseHTTPClient,
        websocket: WebSocketClient,
        stop_on_idle: bool,
    ) -> anyhow::Result<()> {
        let monitor = Monitor::connect(websocket).await?;
        let mut progress_monitor = Self {
            http_client,
            stop_on_idle,
            progress_bar: None,
            progresses: HashMap::new(),
        };

        if !progress_monitor.initial_state().await? {
            return Ok(());
        }

        loop {
            // avoid to many redraws
            sleep(Duration::from_millis(100));

            let event = monitor.pop_last_event().await?;
            if let Some(event) = event {
                match event {
                    api::Event::StageChanged { .. }
                    | api::Event::IssuesChanged { .. }
                    | api::Event::QuestionAdded { .. }
                    | api::Event::ProgressFinished { .. }
                    | api::Event::QuestionAnswered { .. } => {
                        if !progress_monitor.initial_state().await? {
                            break;
                        }
                    }
                    api::Event::ProgressChanged { progress } => {
                        if let Some(main_bar) = &progress_monitor.progress_bar {
                            if let Some(bar) = progress_monitor.progresses.get(&progress.scope) {
                                bar.set_position(progress.index as u64);
                                bar.set_message(progress.step);
                            } else {
                                let bar = Self::create_progress_bar(main_bar, &progress);
                                progress_monitor.progresses.insert(progress.scope, bar);
                            }
                        // there are no multi progress, so init it from scratch
                        } else if !progress_monitor.initial_state().await? {
                            break;
                        }
                    }
                    // we know that rest of events are not provided by monitor
                    // TODO: new enum that has only our interested events
                    _ => {
                        unreachable!()
                    }
                }
            }
        }

        Ok(())
    }

    async fn initial_state(&mut self) -> anyhow::Result<bool> {
        // clear progresses to not interfere with new state
        if let Some(main) = &self.progress_bar {
            for p in self.progresses.values() {
                p.finish_and_clear();
                main.remove(p);
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
        let questions = self.get_unanswered_questions().await?;
        if !questions.is_empty() {
            self.print_questions(&questions).await?;
            return Ok(true);
        }
        let manager_client = ManagerHTTPClient::new(self.http_client.clone());
        let status: api::Status = manager_client.status().await?;
        // if we end installation, then just finish with some nice message
        if status.stage.is_end() {
            Self::print_final_status(&status);
            return Ok(false);
        }
        let progresses = status.progresses;
        // if there are some progress, then it has precedence over issues as it can solve them
        if !progresses.is_empty() {
            let multibar = MultiProgress::new();
            let message = if status.stage == Stage::Configuring {
                gettext("Calculating proposal:")
            } else {
                gettext("Installing target system:")
            };
            multibar.println(message)?;

            for progress in progresses {
                let bar = Self::create_progress_bar(&multibar, &progress);
                self.progresses.insert(progress.scope, bar);
            }
            self.progress_bar = Some(multibar);
            return Ok(true);
        }

        // if we configuring and there are some issue, print it and wait for user to fix it
        if status.stage == Stage::Configuring {
            let issues = manager_client.issues().await?;
            if !issues.is_empty() {
                Self::print_issues(&issues)?;
                return Ok(true);
            }
        }

        Self::print_stage(&status.stage);
        Ok(!self.stop_on_idle)
    }

    async fn get_unanswered_questions(&self) -> anyhow::Result<Vec<Question>> {
        let questions_client = questions::http_client::HTTPClient::new(self.http_client.clone());
        let questions = questions_client.get_questions().await?;

        let questions = questions
            .into_iter()
            .filter(|q| q.answer.is_none())
            .collect();
        Ok(questions)
    }

    fn print_stage(stage: &Stage) {
        match stage {
            Stage::Configuring => println!("{}", gettext("Installation is ready for start.")),
            // installaling without progress means that it probably do not
            // start yet, should be almost invisible blink
            Stage::Installing => println!("{}", gettext("Waiting to start installation")),
            _ => unreachable!(),
        }
    }

    fn print_final_status(status: &api::Status) {
        match status.stage {
            Stage::Finished => println!("{}", gettext("Installation successfully finished")),
            Stage::Failed => println!("{}", gettext("Installation failed")),
            _ => unreachable!(),
        }
    }

    fn clear_terminal() {
        // ignore failure of screen clearing, as it not critical
        let _ = console::Term::stdout().clear_screen();
    }

    async fn print_questions(&self, questions: &Vec<Question>) -> anyhow::Result<()> {
        println!("{}", gettext("There are unanswered questions. Please use `agama questions` command or web interface to answer them:"));
        for q in questions {
            // Should we also print question class?
            println!("  - {}", q.spec.text);
        }
        Ok(())
    }

    fn print_issues(issues: &Vec<IssueWithScope>) -> anyhow::Result<()> {
        println!("{}", gettext("There are issues blocking installation:"));

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

    fn create_progress_bar(multibar: &MultiProgress, progress: &api::Progress) -> ProgressBar {
        let bar = ProgressBar::new(progress.size as u64);
        let template = if progress.scope == Scope::Manager {
            format!(
                "{} ({{pos:>2}}/{{len:2}}): {{wide_msg}}",
                gettext("Current step")
            )
        } else {
            "{bar:40.green} {pos:>5}/{len:5} {wide_msg}".to_string()
        };
        // unwrap is safe as we created the style ( hope rust can do compile time check in future )
        bar.set_style(ProgressStyle::with_template(&template).unwrap());
        bar.set_position(progress.index as u64);
        bar.set_message(progress.step.clone());
        multibar.add(bar)
    }
}
