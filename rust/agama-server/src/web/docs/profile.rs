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

use utoipa::openapi::{Components, ComponentsBuilder, Paths, PathsBuilder};

/// Returns the paths for the profile API endpoints.
pub fn paths() -> Paths {
    PathsBuilder::new()
        .path_from::<crate::profile::web::__path_autoyast>()
        .path_from::<crate::profile::web::__path_evaluate>()
        .path_from::<crate::profile::web::__path_validate>()
        .build()
}

/// Returns the components (schemas) for the profile API.
pub fn components() -> Components {
    ComponentsBuilder::new()
        .schema_from::<crate::web::error::ErrorResponse>()
        .schema_from::<agama_lib::profile::ValidationOutcome>()
        .build()
}
