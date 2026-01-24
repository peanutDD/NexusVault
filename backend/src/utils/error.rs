use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),

    #[error("Authentication error: {0}")]
    Auth(String),

    #[error("Validation error: {0}")]
    Validation(String),

    #[error("File error: {0}")]
    File(String),

    #[error("Storage error: {0}")]
    Storage(String),

    #[error("Not found")]
    NotFound,

    #[error("Unauthorized")]
    Unauthorized,

    #[error("Forbidden")]
    #[allow(dead_code)]
    Forbidden,

    #[error("Internal server error")]
    Internal,
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        use chrono::Utc;

        let error_message = self.to_string();
        let (status, error_code, user_message) = match &self {
            AppError::Database(e) => {
                tracing::error!("Database error: {}", e);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "DATABASE_ERROR",
                    "数据库操作失败，请稍后重试",
                )
            }
            AppError::Auth(msg) => {
                tracing::warn!("Authentication error: {}", msg);
                (
                    StatusCode::UNAUTHORIZED,
                    "AUTH_ERROR",
                    if msg.contains("密码") {
                        "用户名或密码错误"
                    } else if msg.contains("token") || msg.contains("Token") {
                        "登录已过期，请重新登录"
                    } else {
                        "认证失败，请检查登录信息"
                    },
                )
            }
            AppError::Validation(msg) => {
                tracing::warn!("Validation error: {}", msg);
                (StatusCode::BAD_REQUEST, "VALIDATION_ERROR", msg.as_str())
            }
            AppError::File(msg) => {
                tracing::warn!("File error: {}", msg);
                (StatusCode::BAD_REQUEST, "FILE_ERROR", msg.as_str())
            }
            AppError::Storage(msg) => {
                tracing::error!("Storage error: {}", msg);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "STORAGE_ERROR",
                    "文件存储操作失败，请稍后重试",
                )
            }
            AppError::NotFound => (StatusCode::NOT_FOUND, "NOT_FOUND", "请求的资源不存在"),
            AppError::Unauthorized => {
                (StatusCode::UNAUTHORIZED, "UNAUTHORIZED", "未授权，请先登录")
            }
            AppError::Forbidden => (StatusCode::FORBIDDEN, "FORBIDDEN", "没有权限执行此操作"),
            AppError::Internal => {
                tracing::error!("Internal server error");
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "INTERNAL_ERROR",
                    "服务器内部错误，请稍后重试",
                )
            }
        };

        let body = Json(json!({
            "error": error_message,
            "message": user_message,
            "code": error_code,
            "timestamp": Utc::now().to_rfc3339(),
        }));

        (status, body).into_response()
    }
}
