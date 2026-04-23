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

use agama_utils::{api::Event, test};
use aide::openapi::{
    Contact, ExternalDocumentation, Info, License, OpenApi, ReferenceOr, SecurityScheme, Server,
    Tag,
};
use indexmap::IndexMap;
use tokio::sync::broadcast;

use crate::test_utils;

/// Builds the unified OpenAPI specification for the Agama HTTP API using aide.
///
/// Instantiates an ApiRouter using the test_utils::router function and generates
/// the API from there.
pub async fn build() -> OpenApi {
    let mut api = OpenApi {
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
            contact: Some(Contact {
                name: Some("Agama Project Team".to_string()),
                url: Some("https://github.com/agama-project/agama".to_string()),
                email: Some("agama-devel@lists.opensuse.org".to_string()),
                ..Default::default()
            }),
            license: Some(License {
                name: "GPL-2.0".to_string(),
                identifier: None,
                url: Some("https://www.gnu.org/licenses/old-licenses/gpl-2.0.html".to_string()),
                ..Default::default()
            }),
            ..Default::default()
        },
        servers: vec![
            Server {
                url: "http://localhost".to_string(),
                description: Some("Local development server".to_string()),
                ..Default::default()
            },
            Server {
                url: "https://agama.local".to_string(),
                description: Some("Agama server (default hostname)".to_string()),
                ..Default::default()
            },
        ],
        tags: vec![
            Tag {
                name: "Status & Monitoring".to_string(),
                description: Some(
                    "Endpoints for monitoring installation status and progress".to_string(),
                ),
                ..Default::default()
            },
            Tag {
                name: "Configuration".to_string(),
                description: Some("System configuration management".to_string()),
                ..Default::default()
            },
            Tag {
                name: "Actions".to_string(),
                description: Some("Installation actions and commands".to_string()),
                ..Default::default()
            },
            Tag {
                name: "Issues & Questions".to_string(),
                description: Some("Problem tracking and interactive questions".to_string()),
                ..Default::default()
            },
            Tag {
                name: "Licensing".to_string(),
                description: Some("License management and retrieval".to_string()),
                ..Default::default()
            },
        ],
        external_docs: Some(ExternalDocumentation {
            description: Some("Full Agama documentation".to_string()),
            url: "https://agama-project.github.io".to_string(),
            ..Default::default()
        }),
        ..Default::default()
    };

    // Add security schemes
    if api.components.is_none() {
        api.components = Some(Default::default());
    }
    if let Some(components) = &mut api.components {
        let mut security_schemes = IndexMap::new();
        security_schemes.insert(
            "bearerAuth".to_string(),
            ReferenceOr::Item(SecurityScheme::Http {
                scheme: "bearer".to_string(),
                bearer_format: Some("JWT".to_string()),
                description: Some(
                    "JWT token obtained from the authentication endpoint".to_string(),
                ),
                extensions: IndexMap::new(),
            }),
        );
        components.security_schemes = security_schemes;
    }

    let share_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../test/share");
    std::env::set_var("AGAMA_SHARE_DIR", share_dir.display().to_string());

    let (events_tx, _events_rx) = broadcast::channel::<Event>(16);
    let dbus = test::dbus::connection().await.unwrap();
    let app = test_utils::router(events_tx.clone(), dbus.clone())
        .await
        .expect("Failed to build the router to build the OpenAPI specification");
    _ = app.finish_api(&mut api);

    api
}
