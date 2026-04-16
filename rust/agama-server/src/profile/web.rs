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

use crate::web::error::ErrorResponse;
use agama_lib::profile::AutoyastError;
use agama_transfer::Transfer;
use anyhow::Context;

use agama_lib::{
    error::ServiceError,
    profile::{AutoyastProfileImporter, ProfileEvaluator, ProfileValidator, ValidationOutcome},
};
use axum::{response::Response, routing::post, Json, Router};
use serde::Deserialize;
use std::collections::HashMap;
use url::Url;

/// Helper to convert AutoyastError to appropriate HTTP response.
fn autoyast_error_response(error: AutoyastError) -> Response {
    match error {
        AutoyastError::Execute(..) => ErrorResponse::internal_server_error(format!("{:#}", error)),
        _ => ErrorResponse::bad_request(format!("{:#}", error)),
    }
}

/// Helper to convert anyhow::Error to BAD_REQUEST response.
fn bad_request_from_anyhow(error: anyhow::Error) -> Response {
    ErrorResponse::bad_request(format!("{:#}", error))
}

/// Helper to convert anyhow::Error to INTERNAL_SERVER_ERROR response.
fn internal_server_error_from_anyhow(error: anyhow::Error) -> Response {
    ErrorResponse::internal_server_error(format!("{:#}", error))
}

/// Sets up and returns the axum service for the auto-installation profile.
pub async fn profile_service() -> Result<Router, ServiceError> {
    let router = Router::new()
        .route("/evaluate", post(evaluate))
        .route("/validate", post(validate))
        .route("/autoyast", post(autoyast));
    Ok(router)
}

/// For flexibility, the profile operations take the input as either of:
/// 1. request body
/// 2. pathname (server side)
/// 3. URL
#[derive(Deserialize, utoipa::IntoParams, Debug)]
struct ProfileBody {
    path: Option<String>,
    url: Option<String>,
    json: Option<String>,
}

impl ProfileBody {
    /// Parses given string as a JSON and fills ProfileBody accordingly
    ///
    /// Expected format is a HashMap<String, String>, expecte keys are
    /// path, url or profile
    fn from_string(string: String) -> Self {
        let map: HashMap<String, String> = serde_json::from_str(&string).unwrap_or_default();

        Self {
            path: map.get("path").cloned(),
            url: map.get("url").cloned(),
            json: map.get("profile").cloned(),
        }
    }

    /// Retrieve a profile if specified by one of *url*, *path* or
    /// pass already obtained *json* file content
    #[allow(clippy::result_large_err)]
    fn retrieve_profile(&self) -> Result<Option<String>, Response> {
        if let Some(url_string) = &self.url {
            let mut bytebuf = Vec::new();
            Transfer::get(url_string, &mut bytebuf, false)
                .context(format!("Retrieving data from URL {}", url_string))
                .map_err(bad_request_from_anyhow)?;
            let s = String::from_utf8(bytebuf)
                .context(format!("Invalid UTF-8 data at URL {}", url_string))
                .map_err(bad_request_from_anyhow)?;
            Ok(Some(s))
        } else if let Some(path) = &self.path {
            let s = std::fs::read_to_string(path)
                .context(format!("Reading from file {}", path))
                .map_err(bad_request_from_anyhow)?;
            Ok(Some(s))
        } else {
            Ok(self.json.clone())
        }
    }
}

#[utoipa::path(
    post,
    path = "/validate",
    context_path = "/api/profile",
    responses(
        (status = 200, description = "Validation result", body = ValidationOutcome),
        (status = 400, description = "Some error has occurred", body = ErrorResponse)
    )
)]
async fn validate(body: String) -> Result<Json<ValidationOutcome>, Response> {
    let profile = ProfileBody::from_string(body);
    let profile_string = match profile.retrieve_profile()? {
        Some(retrieved) => retrieved,
        None => profile.json.expect("Missing profile"),
    };
    let validator = ProfileValidator::default_schema()
        .context("Setting up profile validator")
        .map_err(bad_request_from_anyhow)?;
    let result = validator
        .validate_str(&profile_string)
        .context("Could not validate the profile".to_string())
        .map_err(internal_server_error_from_anyhow)?;

    Ok(Json(result))
}

#[utoipa::path(
    post,
    path = "/evaluate",
    context_path = "/api/profile",
    responses(
        (status = 200, description = "Evaluated profile", body = String, content_type = "application/json"),
        (status = 400, description = "Some error has occurred", body = ErrorResponse)
    )
)]
async fn evaluate(body: String) -> Result<String, Response> {
    let profile = ProfileBody::from_string(body);
    let profile_string = match profile.retrieve_profile()? {
        Some(retrieved) => retrieved,
        None => profile.json.expect("Missing profile"),
    };
    let evaluator = ProfileEvaluator {};
    let output = evaluator
        .evaluate_string(&profile_string)
        .context("Could not evaluate the profile".to_string())
        .map_err(bad_request_from_anyhow)?;

    Ok(output)
}

#[utoipa::path(
    post,
    path = "/autoyast",
    context_path = "/api/profile",
    responses(
        (status = 200, description = "AutoYaST profile conversion", body = String, content_type = "application/json"),
        (status = 400, description = "Some error has occurred", body = ErrorResponse),
        (status = 500, description = "Internal server error", body = ErrorResponse)
    )
)]
async fn autoyast(body: String) -> Result<String, Response> {
    let profile = ProfileBody::from_string(body);
    if profile.url.is_none() || profile.path.is_some() || profile.json.is_some() {
        return Err(ErrorResponse::bad_request(format!(
            "Only url= is expected, no path= or request body. Seen: url {}, path {}, body {}",
            profile.url.is_some(),
            profile.path.is_some(),
            profile.json.is_some()
        )));
    }

    let url = Url::parse(profile.url.as_ref().unwrap())
        .map_err(|e| bad_request_from_anyhow(anyhow::Error::new(e)))?;
    let importer = AutoyastProfileImporter::read(&url)
        .await
        .map_err(autoyast_error_response)?;
    Ok(importer.content)
}
