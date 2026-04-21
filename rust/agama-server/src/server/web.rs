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

//! This module implements Agama's HTTP API.

use crate::server::config_schema;
use crate::web::error::ErrorResponse;
use agama_lib::{error::ServiceError, logs};
use agama_manager::service::Error as ManagerError;
use agama_manager::users::PasswordCheckResult;
use agama_manager::{self as manager, message, users};
use agama_software::Resolvable;
use agama_utils::{
    actor::Handler,
    api::{
        event,
        manager::LicenseContent,
        query,
        question::{Question, QuestionSpec, UpdateQuestion},
        Action, Config, IssueWithScope, Patch, Proposal, Status, SystemInfo,
    },
    progress, question,
};
use axum::{
    body::Body,
    extract::{Path, Query, State},
    http::HeaderValue,
    response::{IntoResponse, Response},
    routing::{get, post, put},
    Json, Router,
};
use hyper::{header, HeaderMap, StatusCode};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tokio_util::io::ReaderStream;

#[derive(thiserror::Error, Debug)]
pub enum Error {
    #[error(transparent)]
    Manager(#[from] manager::service::Error),
    #[error(transparent)]
    Questions(#[from] question::service::Error),
    #[error(transparent)]
    ConfigSchema(#[from] config_schema::Error),
    #[error(transparent)]
    Json(#[from] serde_json::Error),
    #[error("Missing language tag")]
    MissingLanguageTag,
}

impl Error {
    /// Creates a BAD_REQUEST (400) response from this error.
    fn bad_request(self) -> Response {
        ErrorResponse::bad_request(self)
    }

    /// Creates an INTERNAL_SERVER_ERROR (500) response from this error.
    fn internal_server_error(self) -> Response {
        ErrorResponse::internal_server_error(self)
    }

    /// Creates an UNPROCESSABLE_ENTITY (422) response from this error.
    fn unprocessable_entity(self) -> Response {
        ErrorResponse::unprocessable_entity(self)
    }
}

#[derive(Clone)]
pub struct ServerState {
    manager: Handler<manager::Service>,
    questions: Handler<question::Service>,
}

impl ServerState {
    pub fn new(manager: Handler<manager::Service>, questions: Handler<question::Service>) -> Self {
        Self { manager, questions }
    }
}

// Handlers return Response directly for errors so they can choose the appropriate status code

/// Sets up and returns the axum service for the manager module
///
/// * `events`: channel to send events to the websocket.
/// * `dbus`: connection to Agama's D-Bus server. If it is not given, those features
///   that require to connect to the Agama's D-Bus server won't work.
pub async fn server_service(
    events: event::Sender,
    dbus: zbus::Connection,
) -> Result<Router, ServiceError> {
    let questions = question::start(events.clone())
        .await
        .map_err(anyhow::Error::msg)?;
    let manager = manager::Service::starter(questions.clone(), events, dbus)
        .start()
        .await
        .map_err(anyhow::Error::msg)?;
    let state = ServerState::new(manager, questions);
    server_with_state(state)
}
pub fn server_with_state(state: ServerState) -> Result<Router, ServiceError> {
    Ok(Router::new()
        .route("/status", get(get_status))
        .route("/system", get(get_system))
        .route("/extended_config", get(get_extended_config))
        .route(
            "/config",
            get(get_config).put(put_config).patch(patch_config),
        )
        .route("/proposal", get(get_proposal))
        .route("/action", post(run_action))
        .route("/issues", get(get_issues))
        .route(
            "/questions",
            get(get_questions).post(ask_question).patch(update_question),
        )
        .route("/licenses/{id}", get(get_license))
        .route(
            "/private/storage_model",
            get(get_storage_model).put(set_storage_model),
        )
        .route("/private/solve_storage_model", get(solve_storage_model))
        .route("/private/resolvables/{id}", put(set_resolvables))
        .route("/private/download_logs", get(download_logs))
        .route("/private/password_check", post(check_password))
        .with_state(state))
}

#[utoipa::path(
    get,
    path = "/status",
    context_path = "/api/v2",
    responses(
        (status = 200, description = "Status of the installation.", body = Status),
        (status = 500, description = "Internal server error.", body = ErrorResponse)
    )
)]
async fn get_status(State(state): State<ServerState>) -> Result<Json<Status>, Response> {
    let status = state
        .manager
        .call(progress::message::GetStatus)
        .await
        .map_err(|e| Error::from(e).internal_server_error())?;
    Ok(Json(status))
}

/// Returns the information about the system.
#[utoipa::path(
    get,
    path = "/system",
    context_path = "/api/v2",
    responses(
        (status = 200, description = "System information.", body = SystemInfo),
        (status = 500, description = "Internal server error.", body = ErrorResponse)
    )
)]
async fn get_system(State(state): State<ServerState>) -> Result<Json<SystemInfo>, Response> {
    let system = state
        .manager
        .call(message::GetSystem)
        .await
        .map_err(|e| Error::from(e).internal_server_error())?;
    Ok(Json(system))
}

/// Returns the extended configuration.
#[utoipa::path(
    get,
    path = "/extended_config",
    context_path = "/api/v2",
    responses(
        (status = 200, description = "Extended configuration", body = Config),
        (status = 500, description = "Internal server error.", body = ErrorResponse)
    )
)]
async fn get_extended_config(State(state): State<ServerState>) -> Result<Json<Config>, Response> {
    let config = state
        .manager
        .call(message::GetExtendedConfig)
        .await
        .map_err(|e| Error::from(e).internal_server_error())?;
    Ok(Json(config))
}

/// Returns the configuration.
#[utoipa::path(
    get,
    path = "/config",
    context_path = "/api/v2",
    responses(
        (status = 200, description = "Configuration.", body = Config),
        (status = 500, description = "Internal server error.", body = ErrorResponse)
    )
)]
async fn get_config(State(state): State<ServerState>) -> Result<Json<Config>, Response> {
    let config = state
        .manager
        .call(message::GetConfig)
        .await
        .map_err(|e| Error::from(e).internal_server_error())?;
    Ok(Json(config))
}

/// Updates the configuration.
///
/// Replaces the whole configuration. If some value is missing, it will be removed.
#[utoipa::path(
    put,
    path = "/config",
    context_path = "/api/v2",
    request_body(content = Value, description = "Configuration to apply."),
    responses(
        (status = 200, description = "The configuration was replaced. Other operations can be running in background."),
        (status = 400, description = "Invalid configuration schema or malformed JSON.", body = ErrorResponse),
        (status = 500, description = "Internal server error.", body = ErrorResponse)
    )
)]
async fn put_config(
    State(state): State<ServerState>,
    Json(json): Json<Value>,
) -> Result<(), Response> {
    // Schema validation errors and JSON parsing errors are client errors (400)
    config_schema::check(&json).map_err(|e| Error::from(e).bad_request())?;
    let config = serde_json::from_value(json).map_err(|e| Error::from(e).bad_request())?;
    // Manager errors are internal server errors (500)
    state
        .manager
        .call(message::SetConfig::new(config))
        .await
        .map_err(|e| Error::from(e).internal_server_error())?;
    Ok(())
}

/// Patches the configuration.
///
/// It only changes the specified values, keeping the rest as they are.
#[utoipa::path(
    patch,
    path = "/config",
    context_path = "/api/v2",
    request_body(content = Patch, description = "Changes in the configuration."),
    responses(
        (status = 200, description = "The configuration was patched. Other operations can be running in background."),
        (status = 400, description = "Invalid configuration schema or malformed JSON.", body = ErrorResponse),
        (status = 500, description = "Internal server error.", body = ErrorResponse)
    )
)]
async fn patch_config(
    State(state): State<ServerState>,
    Json(patch): Json<Patch>,
) -> Result<(), Response> {
    if let Some(json) = patch.update {
        // Schema validation errors and JSON parsing errors are client errors (400)
        config_schema::check(&json).map_err(|e| Error::from(e).bad_request())?;
        let config = serde_json::from_value(json).map_err(|e| Error::from(e).bad_request())?;
        // Manager errors are internal server errors (500)
        state
            .manager
            .call(message::UpdateConfig::new(config))
            .await
            .map_err(|e| Error::from(e).internal_server_error())?;
    }
    Ok(())
}

/// Returns how the target system is configured (proposal).
#[utoipa::path(
    get,
    path = "/proposal",
    context_path = "/api/v2",
    responses(
        (status = 200, description = "Proposal successfully retrieved.", body = Proposal),
        (status = 404, description = "Proposal not available yet."),
        (status = 500, description = "Internal server error.", body = ErrorResponse)
    )
)]
async fn get_proposal(State(state): State<ServerState>) -> Result<Response, Response> {
    let proposal = state
        .manager
        .call(message::GetProposal)
        .await
        .map_err(|e| Error::from(e).internal_server_error())?;
    Ok(to_option_response(proposal))
}

/// Returns the list of issues.
#[utoipa::path(
    get,
    path = "/issues",
    context_path = "/api/v2",
    responses(
        (status = 200, description = "Agama issues", body = Vec<IssueWithScope>),
        (status = 500, description = "Internal server error.", body = ErrorResponse)
    )
)]
async fn get_issues(
    State(state): State<ServerState>,
) -> Result<Json<Vec<IssueWithScope>>, Response> {
    let issue_groups = state
        .manager
        .call(message::GetIssues)
        .await
        .map_err(|e| Error::from(e).internal_server_error())?;

    let issues = issue_groups
        .into_iter()
        .flat_map(|(scope, issues)| -> Vec<IssueWithScope> {
            issues
                .into_iter()
                .map(|issue| IssueWithScope { scope, issue })
                .collect()
        })
        .collect();

    Ok(Json(issues))
}

/// Returns the issues for each scope.
#[utoipa::path(
    get,
    path = "/questions",
    context_path = "/api/v2",
    responses(
        (status = 200, description = "Agama questions", body = HashMap<u32, QuestionSpec>),
        (status = 500, description = "Internal server error.", body = ErrorResponse)
    )
)]
async fn get_questions(State(state): State<ServerState>) -> Result<Json<Vec<Question>>, Response> {
    let questions = state
        .questions
        .call(question::message::Get)
        .await
        .map_err(|e| Error::from(e).internal_server_error())?;
    Ok(Json(questions))
}

/// Registers a new question.
#[utoipa::path(
    post,
    path = "/questions",
    context_path = "/api/v2",
    responses(
        (status = 200, description = "New question's ID", body = u32),
        (status = 400, description = "Malformed JSON.", body = ErrorResponse),
        (status = 500, description = "Internal server error.", body = ErrorResponse)
    )
)]
async fn ask_question(
    State(state): State<ServerState>,
    Json(question): Json<QuestionSpec>,
) -> Result<Json<Question>, Response> {
    let question = state
        .questions
        .call(question::message::Ask::new(question))
        .await
        .map_err(|e| Error::from(e).internal_server_error())?;
    Ok(Json(question))
}

/// Updates the question collection by answering or removing a question.
#[utoipa::path(
    patch,
    path = "/questions",
    context_path = "/api/v2",
    request_body = UpdateQuestion,
    responses(
        (status = 200, description = "The question was answered or deleted"),
        (status = 400, description = "Malformed JSON.", body = ErrorResponse),
        (status = 500, description = "Internal server error.", body = ErrorResponse)
    )
)]
async fn update_question(
    State(state): State<ServerState>,
    Json(operation): Json<UpdateQuestion>,
) -> Result<(), Response> {
    match operation {
        UpdateQuestion::Answer { id, answer } => {
            state
                .questions
                .call(question::message::Answer { id, answer })
                .await
                .map_err(|e| Error::from(e).internal_server_error())?;
        }
        UpdateQuestion::Delete { id } => {
            state
                .questions
                .call(question::message::Delete { id })
                .await
                .map_err(|e| Error::from(e).internal_server_error())?;
        }
    }
    Ok(())
}

#[derive(Deserialize, utoipa::IntoParams)]
struct LicenseQuery {
    lang: Option<String>,
}

/// Returns the license content.
///
/// Optionally it can receive a language tag (RFC 5646). Otherwise, it returns
/// the license in English.
#[utoipa::path(
    get,
    path = "/licenses/{id}",
    context_path = "/api/software",
    params(LicenseQuery),
    responses(
        (status = 200, description = "License with the given ID", body = LicenseContent),
        (status = 400, description = "The specified language tag is not valid", body = ErrorResponse),
        (status = 404, description = "There is not license with the given ID"),
        (status = 500, description = "Internal server error.", body = ErrorResponse)
    )
)]
async fn get_license(
    State(state): State<ServerState>,
    Path(id): Path<String>,
    Query(query): Query<LicenseQuery>,
) -> Result<Response, Response> {
    let lang = query.lang.unwrap_or("en".to_string());
    let lang = lang
        .as_str()
        .try_into()
        .map_err(|_| Error::MissingLanguageTag.bad_request())?;

    let license = state
        .manager
        .call(message::GetLicense::new(id.to_string(), lang))
        .await
        .map_err(|e| Error::from(e).internal_server_error())?;
    if let Some(license) = license {
        Ok(Json(license).into_response())
    } else {
        Ok(StatusCode::NOT_FOUND.into_response())
    }
}

#[utoipa::path(
    post,
    path = "/action",
    context_path = "/api/v2",
    request_body(content = Action, description = "Description of the action to run."),
    responses(
        (status = 200, description = "Action successfully ran."),
        (status = 422, description = "Action blocked by backend state", body = ErrorResponse),
        (status = 500, description = "Internal server error.", body = ErrorResponse)
    )
)]
async fn run_action(
    State(state): State<ServerState>,
    Json(action): Json<Action>,
) -> Result<(), Response> {
    // RunAction can fail with PendingIssues or Busy errors (422) or other errors (500)
    state
        .manager
        .call(message::RunAction::new(action))
        .await
        .map_err(|error| match &error {
            ManagerError::PendingIssues { .. } | ManagerError::Busy { .. } => {
                Error::from(error).unprocessable_entity()
            }
            _ => Error::from(error).internal_server_error(),
        })?;
    Ok(())
}

/// Returns how the target system is configured (proposal).
#[utoipa::path(
    get,
    path = "/private/storage_model",
    context_path = "/api/v2",
    responses(
        (status = 200, description = "Storage model was successfully retrieved."),
        (status = 500, description = "Internal server error.", body = ErrorResponse)
    )
)]
async fn get_storage_model(
    State(state): State<ServerState>,
) -> Result<Json<Option<Value>>, Response> {
    let model = state
        .manager
        .call(message::GetStorageModel)
        .await
        .map_err(|e| Error::from(e).internal_server_error())?;
    Ok(Json(model))
}

#[utoipa::path(
    put,
    request_body = String,
    path = "/private/storage_model",
    context_path = "/api/v2",
    responses(
        (status = 200, description = "Set the storage model"),
        (status = 400, description = "Malformed JSON.", body = ErrorResponse),
        (status = 500, description = "Internal server error.", body = ErrorResponse)
    )
)]
async fn set_storage_model(
    State(state): State<ServerState>,
    Json(model): Json<Value>,
) -> Result<(), Response> {
    state
        .manager
        .call(message::SetStorageModel::new(model))
        .await
        .map_err(|e| Error::from(e).internal_server_error())?;
    Ok(())
}

/// Solves a storage config model.
#[utoipa::path(
    get,
    path = "/private/solve_storage_model",
    context_path = "/api/v2",
    params(query::SolveStorageModel),
    responses(
        (status = 200, description = "Solve the storage model", body = String),
        (status = 500, description = "Internal server error.", body = ErrorResponse)
    )
)]
async fn solve_storage_model(
    State(state): State<ServerState>,
    Query(params): Query<query::SolveStorageModel>,
) -> Result<Json<Option<Value>>, Response> {
    let solved_model = state
        .manager
        .call(message::SolveStorageModel::new(params.model))
        .await
        .map_err(|e| Error::from(e).internal_server_error())?;
    Ok(Json(solved_model))
}

#[utoipa::path(
    put,
    path = "/resolvables/{id}",
    context_path = "/api/v2",
    responses(
        (status = 200, description = "The resolvables list was updated.")
    )
)]
async fn set_resolvables(
    State(state): State<ServerState>,
    Path(id): Path<String>,
    Json(resolvables): Json<Vec<Resolvable>>,
) -> Result<(), Response> {
    state
        .manager
        .cast(agama_software::message::SetResolvables::new(
            id,
            resolvables,
        ))
        .map_err(|e| Error::from(e).internal_server_error())?;
    Ok(())
}

fn to_option_response<T: Serialize>(value: Option<T>) -> Response {
    match value {
        Some(inner) => Json(inner).into_response(),
        None => StatusCode::NOT_FOUND.into_response(),
    }
}

/// Solves a storage config model.
#[utoipa::path(
    get,
    path = "/private/download_logs",
    context_path = "/api/v2",
    params(query::SolveStorageModel),
    responses(
        (status = 200, description = "Compressed Agama logs", content_type="application/octet-stream", body = String),
        (status = 500, description = "Cannot collect the logs"),
        (status = 507, description = "Server is probably out of space"),
    )
)]
async fn download_logs() -> impl IntoResponse {
    let mut headers = HeaderMap::new();
    let err_response = (headers.clone(), Body::empty());

    match logs::store() {
        Ok(path) => {
            if let Ok(file) = tokio::fs::File::open(path.clone()).await {
                let stream = ReaderStream::new(file);
                let body = Body::from_stream(stream);
                let _ = std::fs::remove_file(path.clone());

                // See RFC2046, RFC2616 and
                // https://www.iana.org/assignments/media-types/media-types.xhtml
                // or /etc/mime.types
                headers.insert(
                    header::CONTENT_TYPE,
                    HeaderValue::from_static("application/x-compressed-tar"),
                );
                if let Some(file_name) = path.file_name() {
                    let disposition =
                        format!("attachment; filename=\"{}\"", &file_name.to_string_lossy());
                    headers.insert(
                        header::CONTENT_DISPOSITION,
                        HeaderValue::from_str(&disposition)
                            .unwrap_or_else(|_| HeaderValue::from_static("attachment")),
                    );
                }
                headers.insert(
                    header::CONTENT_ENCODING,
                    HeaderValue::from_static(logs::DEFAULT_COMPRESSION.1),
                );

                (StatusCode::OK, (headers, body))
            } else {
                (StatusCode::INSUFFICIENT_STORAGE, err_response)
            }
        }
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, err_response),
    }
}

#[derive(Deserialize, utoipa::ToSchema, JsonSchema)]
pub struct PasswordParams {
    password: String,
}

#[utoipa::path(
    post,
    path = "/private/password_check",
    context_path = "/api/v2",
    description = "Performs a quality check on a given password",
    responses(
        (status = 200, description = "The password was checked", body = String),
        (status = 400, description = "Malformed JSON.", body = ErrorResponse),
        (status = 500, description = "Internal server error.", body = ErrorResponse)
    )
)]
async fn check_password(
    State(state): State<ServerState>,
    Json(password): Json<PasswordParams>,
) -> Result<Json<PasswordCheckResult>, Response> {
    let result = state
        .manager
        .call(users::message::CheckPassword::new(password.password))
        .await
        .map_err(|e| Error::from(e).internal_server_error())?;
    Ok(Json(result))
}
