//! # 统一错误处理模块
//!
//! 定义应用的统一错误类型 `AppError`，实现错误到 HTTP 响应的自动转换。
//!
//! ## 设计原则
//!
//! 1. **语义明确**: 每种错误类型对应特定的业务场景
//! 2. **友好消息**: 向用户展示友好的错误消息，隐藏技术细节
//! 3. **日志分级**: 根据错误严重程度使用不同日志级别
//! 4. **标准 HTTP 状态码**: 映射到合适的 HTTP 状态码
//! 5. **安全脱敏**: 敏感错误信息仅记录到日志，不暴露给用户

use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;
use thiserror::Error;
use uuid::Uuid;

/// 应用统一错误类型
///
/// 所有服务层和处理层的错误都应转换为此类型。
#[derive(Error, Debug)]
pub enum AppError {
    /// 数据库操作错误
    ///
    /// 由 SQLx 错误自动转换，返回 500 状态码。
    /// 向用户显示通用消息，详细信息记录到日志。
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),

    /// 认证错误
    ///
    /// 用于登录失败、密码错误等场景，返回 401 状态码。
    #[error("Authentication error: {0}")]
    Auth(String),

    /// 输入验证错误
    ///
    /// 用于请求参数验证失败，返回 400 状态码。
    /// 消息直接展示给用户。
    #[error("Validation error: {0}")]
    Validation(String),

    /// 文件操作错误
    ///
    /// 用于文件读写、格式等问题，返回 400 状态码。
    #[error("File error: {0}")]
    File(String),

    /// 存储后端错误
    ///
    /// 用于本地文件系统或 S3 操作失败，返回 500 状态码。
    #[error("Storage error: {0}")]
    Storage(String),

    /// 资源不存在
    ///
    /// 用于请求的资源（文件、用户等）不存在，返回 404 状态码。
    #[error("Not found")]
    NotFound,

    /// 未认证
    ///
    /// 用于缺少或无效的认证信息，返回 401 状态码。
    #[error("Unauthorized")]
    Unauthorized,

    /// 无权限
    ///
    /// 用于已认证但没有执行权限，返回 403 状态码。
    #[error("Forbidden")]
    Forbidden,

    /// 资源冲突
    ///
    /// 用于资源已存在（如用户名/邮箱重复），返回 409 状态码。
    #[error("Conflict: {0}")]
    Conflict(String),

    /// 请求体过大
    ///
    /// 用于上传文件超过限制，返回 413 状态码。
    #[error("Payload too large: {0}")]
    PayloadTooLarge(String),

    /// 请求过于频繁
    ///
    /// 用于触发速率限制，返回 429 状态码。
    #[error("Rate limit exceeded")]
    RateLimit,

    /// 服务器内部错误
    ///
    /// 用于未预期的错误，返回 500 状态码。
    /// 向用户显示通用消息，详细信息记录到日志。
    #[error("Internal server error")]
    Internal,
}

impl AppError {
    /// 对数据库错误信息进行脱敏
    ///
    /// 移除可能包含的表名、列名、SQL 语句等敏感信息
    fn sanitize_db_error(e: &sqlx::Error) -> String {
        match e {
            sqlx::Error::RowNotFound => "row not found".to_string(),
            sqlx::Error::PoolTimedOut => "connection pool timeout".to_string(),
            sqlx::Error::PoolClosed => "connection pool closed".to_string(),
            sqlx::Error::Configuration(_) => "configuration error".to_string(),
            sqlx::Error::Tls(_) => "TLS error".to_string(),
            sqlx::Error::Protocol(_) => "protocol error".to_string(),
            sqlx::Error::TypeNotFound { .. } => "type not found".to_string(),
            sqlx::Error::ColumnNotFound(_) => "column not found".to_string(),
            sqlx::Error::ColumnIndexOutOfBounds { .. } => "column index out of bounds".to_string(),
            sqlx::Error::ColumnDecode { .. } => "column decode error".to_string(),
            sqlx::Error::Io(_) => "IO error".to_string(),
            sqlx::Error::Database(db_err) => {
                // 仅记录错误码，不记录完整消息（可能包含 SQL）
                format!("database error (code: {:?})", db_err.code())
            }
            _ => "unknown database error".to_string(),
        }
    }

    /// 对存储错误信息进行脱敏
    ///
    /// 移除可能包含的文件路径等敏感信息
    fn sanitize_storage_error(msg: &str) -> String {
        // 移除路径信息
        if msg.contains('/') || msg.contains('\\') {
            "storage operation failed".to_string()
        } else {
            msg.to_string()
        }
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        use chrono::Utc;

        // 生成唯一的错误 ID，用于关联日志和用户报告
        let error_id = Uuid::new_v4().to_string()[..8].to_string();
        let timestamp = Utc::now();

        let (status, error_code, user_message) = match &self {
            // 数据库错误 - 500
            AppError::Database(e) => {
                // 脱敏后记录日志
                let sanitized = Self::sanitize_db_error(e);
                tracing::error!(
                    error_id = %error_id,
                    error_type = "database",
                    details = %sanitized,
                    "Database error occurred"
                );
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "DATABASE_ERROR",
                    "数据库操作失败，请稍后重试".to_string(),
                )
            }

            // 认证错误 - 401
            AppError::Auth(msg) => {
                // 认证错误可以记录，但不记录密码
                let safe_msg = if msg.contains("password") || msg.contains("密码") {
                    "invalid credentials"
                } else {
                    msg.as_str()
                };
                tracing::warn!(
                    error_id = %error_id,
                    error_type = "auth",
                    details = %safe_msg,
                    "Authentication error"
                );
                let user_msg = match () {
                    _ if msg.contains("密码") || msg.contains("password") => "用户名或密码错误",
                    _ if msg.to_lowercase().contains("token") => "登录已过期，请重新登录",
                    _ => "认证失败，请检查登录信息",
                };
                (StatusCode::UNAUTHORIZED, "AUTH_ERROR", user_msg.to_string())
            }

            // 验证错误 - 400
            AppError::Validation(msg) => {
                tracing::debug!(
                    error_id = %error_id,
                    error_type = "validation",
                    details = %msg,
                    "Validation error"
                );
                (StatusCode::BAD_REQUEST, "VALIDATION_ERROR", msg.clone())
            }

            // 文件错误 - 400
            AppError::File(msg) => {
                // 文件错误可能包含路径，脱敏处理
                let safe_msg = Self::sanitize_storage_error(msg);
                tracing::warn!(
                    error_id = %error_id,
                    error_type = "file",
                    details = %safe_msg,
                    "File error"
                );
                // 返回给用户的消息不包含路径
                let user_msg = if msg.contains('/') || msg.contains('\\') {
                    "文件操作失败".to_string()
                } else {
                    msg.clone()
                };
                (StatusCode::BAD_REQUEST, "FILE_ERROR", user_msg)
            }

            // 存储错误 - 500
            AppError::Storage(msg) => {
                // 存储错误可能包含路径，脱敏处理
                let safe_msg = Self::sanitize_storage_error(msg);
                tracing::error!(
                    error_id = %error_id,
                    error_type = "storage",
                    details = %safe_msg,
                    "Storage error"
                );
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "STORAGE_ERROR",
                    "文件存储操作失败，请稍后重试".to_string(),
                )
            }

            // 资源不存在 - 404
            AppError::NotFound => {
                tracing::debug!(
                    error_id = %error_id,
                    error_type = "not_found",
                    "Resource not found"
                );
                (
                    StatusCode::NOT_FOUND,
                    "NOT_FOUND",
                    "请求的资源不存在".to_string(),
                )
            }

            // 未授权 - 401
            AppError::Unauthorized => {
                tracing::debug!(
                    error_id = %error_id,
                    error_type = "unauthorized",
                    "Unauthorized access attempt"
                );
                (
                    StatusCode::UNAUTHORIZED,
                    "UNAUTHORIZED",
                    "未授权，请先登录".to_string(),
                )
            }

            // 无权限 - 403
            AppError::Forbidden => {
                tracing::warn!(
                    error_id = %error_id,
                    error_type = "forbidden",
                    "Forbidden access attempt"
                );
                (
                    StatusCode::FORBIDDEN,
                    "FORBIDDEN",
                    "没有权限执行此操作".to_string(),
                )
            }

            // 资源冲突 - 409
            AppError::Conflict(msg) => {
                tracing::debug!(
                    error_id = %error_id,
                    error_type = "conflict",
                    details = %msg,
                    "Resource conflict"
                );
                (StatusCode::CONFLICT, "CONFLICT", msg.clone())
            }

            // 请求体过大 - 413
            AppError::PayloadTooLarge(msg) => {
                tracing::warn!(
                    error_id = %error_id,
                    error_type = "payload_too_large",
                    details = %msg,
                    "Payload too large"
                );
                (
                    StatusCode::PAYLOAD_TOO_LARGE,
                    "PAYLOAD_TOO_LARGE",
                    msg.clone(),
                )
            }

            // 请求过于频繁 - 429
            AppError::RateLimit => {
                tracing::warn!(
                    error_id = %error_id,
                    error_type = "rate_limit",
                    "Rate limit exceeded"
                );
                (
                    StatusCode::TOO_MANY_REQUESTS,
                    "RATE_LIMIT_EXCEEDED",
                    "请求过于频繁，请稍后再试".to_string(),
                )
            }

            // 内部错误 - 500
            AppError::Internal => {
                tracing::error!(
                    error_id = %error_id,
                    error_type = "internal",
                    "Internal server error"
                );
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "INTERNAL_ERROR",
                    "服务器内部错误，请稍后重试".to_string(),
                )
            }
        };

        // 响应体不包含原始错误信息，只包含脱敏后的用户消息
        let body = Json(json!({
            "message": user_message,
            "code": error_code,
            "error_id": error_id,
            "timestamp": timestamp.to_rfc3339(),
        }));

        (status, body).into_response()
    }
}
