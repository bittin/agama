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

use utoipa::openapi::{Components, Paths};

use super::{ApiDocBuilder, ConfigApiDocBuilder, MiscApiDocBuilder, ProfileApiDocBuilder};

/// Unified OpenAPI documentation builder that merges all API specs into a single document.
pub struct UnifiedApiDocBuilder;

impl ApiDocBuilder for UnifiedApiDocBuilder {
    fn title(&self) -> String {
        "Agama HTTP API".to_string()
    }

    fn description(&self) -> String {
        "Complete HTTP API for the Agama installer. \
        This unified specification includes endpoints for system configuration, \
        installation profiles, and utility functions. \
        See https://agama-project.github.io for more information.".to_string()
    }

    fn paths(&self) -> Paths {
        // Merge paths from all API builders
        let config_paths = ConfigApiDocBuilder.paths();
        let misc_paths = MiscApiDocBuilder.paths();
        let profile_paths = ProfileApiDocBuilder.paths();

        let mut paths = config_paths;
        paths.paths.extend(misc_paths.paths);
        paths.paths.extend(profile_paths.paths);

        paths
    }

    fn components(&self) -> Components {
        // Merge components (schemas) from all API builders
        let config_components = ConfigApiDocBuilder.components();
        let misc_components = MiscApiDocBuilder.components();
        let profile_components = ProfileApiDocBuilder.components();

        let mut components = config_components;

        // Merge schemas from misc and profile components
        components.schemas.extend(misc_components.schemas);
        components.schemas.extend(profile_components.schemas);

        components
    }
}
