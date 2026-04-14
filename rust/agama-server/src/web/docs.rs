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

use utoipa::openapi::{
    Components, Info, InfoBuilder, OpenApi, OpenApiBuilder, Paths,
    server::{Server, ServerBuilder, ServerVariableBuilder},
};

mod config;
pub use config::ConfigApiDocBuilder;
mod profile;
pub use profile::ProfileApiDocBuilder;
mod misc;
pub use misc::MiscApiDocBuilder;

pub trait ApiDocBuilder {
    fn title(&self) -> String {
        "Agama HTTP API".to_string()
    }

    fn description(&self) -> String {
        "HTTP API for the Agama installer. \
        See https://agama-project.github.io for more information.".to_string()
    }

    fn paths(&self) -> Paths;

    fn components(&self) -> Components;

    fn info(&self) -> Info {
        InfoBuilder::new()
            .title(self.title())
            .version(env!("CARGO_PKG_VERSION"))
            .description(Some(self.description()))
            .build()
    }

    fn servers(&self) -> Vec<Server> {
        vec![
            ServerBuilder::new()
                .url("http://localhost")
                .description(Some("Local development server"))
                .build(),
            ServerBuilder::new()
                .url("https://{agamaHost}")
                .description(Some("Agama server"))
                .parameter(
                    "agamaHost",
                    ServerVariableBuilder::new()
                        .default_value("agama.local")
                        .description(Some("Hostname or IP address of the Agama server"))
                        .build(),
                )
                .build(),
        ]
    }

    fn nested(&self) -> Option<OpenApi> {
        None
    }

    fn build(&self) -> utoipa::openapi::OpenApi {
        let mut api = OpenApiBuilder::new()
            .info(self.info())
            .servers(Some(self.servers()))
            .paths(self.paths())
            .components(Some(self.components()))
            .build();

        if let Some(nested) = self.nested() {
            api.merge(nested);
        }
        api
    }
}
