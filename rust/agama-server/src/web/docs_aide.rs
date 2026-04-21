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

use aide::openapi::{Info, OpenApi, Server};

/// Builds the unified OpenAPI specification for the Agama HTTP API using aide.
///
/// This function will eventually replace the utoipa-based `docs::build()`.
/// Currently used for parallel generation during migration.
pub fn build() -> OpenApi {
    let api = OpenApi {
        openapi: "3.1.0".into(),
        info: Info {
            title: "Agama HTTP API".to_string(),
            version: env!("CARGO_PKG_VERSION").to_string(),
            description: Some(
                "Complete HTTP API for the Agama installer. \
                This unified specification includes endpoints for system configuration, \
                installation profiles, and utility functions. \
                See https://agama-project.github.io for more information."
                    .to_string(),
            ),
            ..Default::default()
        },
        servers: vec![
            Server {
                url: "http://localhost".to_string(),
                description: Some("Local development server".to_string()),
                ..Default::default()
            },
            // TODO Phase 1: Simplified - add server variables later
            Server {
                url: "https://agama.local".to_string(),
                description: Some("Agama server (default hostname)".to_string()),
                ..Default::default()
            },
        ],
        ..Default::default()
    };

    // TODO: Add paths and components from handlers
    // This is a placeholder structure for Phase 1
    // Paths and components will be added in Phase 4 when migrating endpoints

    api
}
