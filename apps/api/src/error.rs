use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde_json::json;

use crate::time::now_iso;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("{0}")]
    Unauthorized(String),
    #[error("{0}")]
    Forbidden(String),
    #[error("{0}")]
    NotFound(String),
    #[error("{0}")]
    BadRequest(String),
    #[error("internal")]
    Internal(String),
}

impl AppError {
    pub fn unauthorized(message: impl Into<String>) -> Self {
        Self::Unauthorized(message.into())
    }

    pub fn forbidden(message: impl Into<String>) -> Self {
        Self::Forbidden(message.into())
    }

    pub fn not_found(message: impl Into<String>) -> Self {
        Self::NotFound(message.into())
    }

    pub fn bad_request(message: impl Into<String>) -> Self {
        Self::BadRequest(message.into())
    }
}

impl From<sqlx::Error> for AppError {
    fn from(err: sqlx::Error) -> Self {
        if let sqlx::Error::Database(db) = &err {
            let code = db.code().map(|c| c.to_string()).unwrap_or_default();
            if matches!(
                code.as_str(),
                "23514" | "23503" | "23502" | "22P02" | "23505"
            ) {
                return Self::BadRequest("Invalid value".into());
            }
        }
        Self::Internal(err.to_string())
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, message) = match self {
            Self::Unauthorized(message) => (StatusCode::UNAUTHORIZED, message),
            Self::Forbidden(message) => (StatusCode::FORBIDDEN, message),
            Self::NotFound(message) => (StatusCode::NOT_FOUND, message),
            Self::BadRequest(message) => (StatusCode::BAD_REQUEST, message),
            Self::Internal(detail) => {
                tracing::error!("{detail}");
                (StatusCode::INTERNAL_SERVER_ERROR, "Internal error".into())
            }
        };
        (
            status,
            Json(json!({
                "success": false,
                "message": message,
                "timestamp": now_iso(),
            })),
        )
            .into_response()
    }
}
