// Copyright (c) [2024] SUSE LLC
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

use std::path::PathBuf;

use crate::auth::AuthCommands;
use crate::config::ConfigCommands;
use crate::logs::LogsCommands;
use crate::questions::QuestionsCommands;
use crate::FinishMethod;
use clap::Subcommand;

#[derive(Subcommand, Debug)]
pub enum Commands {
    /// Inspect or change the installation settings.
    ///
    /// You can inspect and change installation settings from the command-line. The "show"
    /// subcommand generates a "profile" which is a JSON document describing the current
    /// configuration.
    ///
    /// If you want to change any configuration value, you can load a profile (complete or partial)
    /// using the "load" subcommand.
    #[command(subcommand)]
    Config(ConfigCommands),

    /// Analyze the system.
    ///
    /// In Agama's jargon, the term 'probing' refers to the process of 'analyzing' the system. This
    /// includes reading software repositories, analyzing storage devices, and more. The 'probe'
    /// command initiates this analysis process and returns immediately.

    /// TODO: do we really need a "probe" action?
    Probe,

    /// Start the system installation.
    ///
    /// This command starts the installation process.  Beware it is a destructive operation because
    /// it will set up the storage devices, install the packages, etc.
    ///
    /// When the preconditions for the installation are not met, it informs the user and returns,
    /// making no changes to the system.
    Install,

    /// Handle installer questions.
    ///
    /// Agama might require user intervention at any time. The reasons include providing some
    /// missing information (e.g., the password to decrypt a file system) or deciding what to do in
    /// case of an error (e.g., cannot connect to the repository).
    ///
    /// This command allows answering such questions directly from the command-line.
    #[command(subcommand)]
    Questions(QuestionsCommands),

    /// Collect the installer logs.
    ///
    /// The installer logs are stored in a compressed archive for further inspection. The file
    /// includes system and Agama-specific logs and configuration files. They are crucial to
    /// troubleshoot and debug problems.
    #[command(subcommand)]
    Logs(LogsCommands),

    /// Authenticate with Agama's server.
    ///
    /// Unless you are executing this program as root, you need to authenticate with Agama's server
    /// for most operations. You can log in by specifying the root password through the "auth login"
    /// command. Upon successful authentication, the server returns a JSON Web Token (JWT) which is
    /// stored to authenticate the following requests.
    ///
    /// If you run this program as root, you can skip the authentication step because it
    /// automatically uses the master token at /run/agama/token. Only the root user must have access
    /// to such a file.
    ///
    /// You can logout at any time by using the "auth logout" command, although this command does
    /// not affect the root user.
    #[command(subcommand)]
    Auth(AuthCommands),

    /// Download file from a given (AutoYaST) URL
    ///
    /// The purpose of this command is to download files using AutoYaST supported schemas (e.g. device://).
    /// It can be used to download additional scripts, configuration files and so on.
    /// You can use it for downloading Agama autoinstallation profiles.
    /// If you want to convert an AutoYaST profile, use "agama config generate".
    Download {
        /// URL reference pointing to file for download. If a relative URL is
        /// provided, it will be resolved against the current working directory.
        url: String,
        /// File name
        destination: PathBuf,
        /// Disables SSL verification for HTTPS downloads
        #[arg(short, long)]
        insecure: bool,
    },
    /// Finish the installation.
    Finish {
        /// What to do after finishing the installation. Possible values:
        ///
        /// stop - do not reboot and the Agama backend continues running.
        ///
        /// reboot - reboot into the installed system.
        ///
        /// halt - halt the installed machine.
        ///
        /// poweroff - power off the installed machine.
        #[clap(default_value = "reboot")]
        method: Option<FinishMethod>,
    },

    /// Monitors the Agama service.
    Monitor,

    /// Display Agama events.
    Events {
        /// Display the events in a more human-readable way.
        #[arg(short, long)]
        pretty: bool,
    },
}
