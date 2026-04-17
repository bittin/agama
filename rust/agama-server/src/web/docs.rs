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
    server::{ServerBuilder, ServerVariableBuilder},
    InfoBuilder, OpenApi, OpenApiBuilder,
};

mod config;
mod misc;
mod profile;

/// Builds the unified OpenAPI specification for the Agama HTTP API.
///
/// This function merges all API endpoints and schemas from the different
/// modules (config, misc, profile) into a single OpenAPI document.
pub fn build() -> OpenApi {
    let mut paths = config::paths();
    paths.paths.extend(misc::paths().paths);
    paths.paths.extend(profile::paths().paths);

    let mut components = config::components();
    components.schemas.extend(misc::components().schemas);
    components.schemas.extend(profile::components().schemas);

    let info = InfoBuilder::new()
        .title("Agama HTTP API")
        .version(env!("CARGO_PKG_VERSION"))
        .description(Some(
            "Complete HTTP API for the Agama installer. \
            This unified specification includes endpoints for system configuration, \
            installation profiles, and utility functions. \
            See https://agama-project.github.io for more information.",
        ))
        .build();

    let servers = vec![
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
    ];

    OpenApiBuilder::new()
        .info(info)
        .servers(Some(servers))
        .paths(paths)
        .components(Some(components))
        .build()
}
