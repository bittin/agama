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

use agama_lib::error::ServiceError;
use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;

use crate::{
    l10n::LocaleError,
    questions::QuestionsError,
    users::password::PasswordCheckerError,
    web::common::{IssuesServiceError, ProgressServiceError},
};

#[derive(thiserror::Error, Debug)]
pub enum Error {
    #[error("D-Bus error: {0}")]
    DBus(#[from] zbus::Error),
    #[error("Generic error: {0}")]
    Anyhow(String),
    #[error("Agama service error: {0}")]
    Service(#[from] ServiceError),
    #[error("Questions service error: {0}")]
    Questions(QuestionsError),
    #[error("Software service error: {0}")]
    Locale(#[from] LocaleError),
    #[error("Issues service error: {0}")]
    Issues(#[from] IssuesServiceError),
    #[error("Progress service error: {0}")]
    Progress(#[from] ProgressServiceError),
    #[error("Could not check the password")]
    PasswordCheck(#[from] PasswordCheckerError),
}

// This would be nice, but using it for a return type
// results in a confusing error message about
// error[E0277]: the trait bound `MyError: Serialize` is not satisfied
//type MyResult<T> = Result<T, MyError>;

impl From<anyhow::Error> for Error {
    fn from(e: anyhow::Error) -> Self {
        // `#` is std::fmt "Alternate form", anyhow::Error interprets as "include causes"
        Self::Anyhow(format!("{:#}", e))
    }
}

impl From<Error> for zbus::fdo::Error {
    fn from(value: Error) -> zbus::fdo::Error {
        zbus::fdo::Error::Failed(format!("D-Bus error: {value}"))
    }
}

impl IntoResponse for Error {
    fn into_response(self) -> Response {
        tracing::warn!("Server return error {}", self);
        let body = json!({
            "error": self.to_string()
        });
        (StatusCode::BAD_REQUEST, Json(body)).into_response()
    }
}
