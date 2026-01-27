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

use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;
use thiserror::Error;

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

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        use chrono::Utc;

        let error_message = self.to_string();
        let (status, error_code, user_message) = match &self {
            // 数据库错误 - 500
            AppError::Database(e) => {
                tracing::error!("Database error: {}", e);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "DATABASE_ERROR",
                    "数据库操作失败，请稍后重试".to_string(),
                )
            }

            // 认证错误 - 401（使用 match 模式替代 if-else 链）
            AppError::Auth(msg) => {
                tracing::warn!("Authentication error: {}", msg);
                let user_msg = match () {
                    _ if msg.contains("密码") => "用户名或密码错误",
                    _ if msg.to_lowercase().contains("token") => "登录已过期，请重新登录",
                    _ => "认证失败，请检查登录信息",
                };
                (StatusCode::UNAUTHORIZED, "AUTH_ERROR", user_msg.to_string())
            }

            // 验证错误 - 400
            AppError::Validation(msg) => {
                tracing::warn!("Validation error: {}", msg);
                (StatusCode::BAD_REQUEST, "VALIDATION_ERROR", msg.clone())
            }

            // 文件错误 - 400
            AppError::File(msg) => {
                tracing::warn!("File error: {}", msg);
                (StatusCode::BAD_REQUEST, "FILE_ERROR", msg.clone())
            }

            // 存储错误 - 500
            AppError::Storage(msg) => {
                tracing::error!("Storage error: {}", msg);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "STORAGE_ERROR",
                    "文件存储操作失败，请稍后重试".to_string(),
                )
            }

            // 资源不存在 - 404
            AppError::NotFound => (
                StatusCode::NOT_FOUND,
                "NOT_FOUND",
                "请求的资源不存在".to_string(),
            ),

            // 未授权 - 401
            AppError::Unauthorized => (
                StatusCode::UNAUTHORIZED,
                "UNAUTHORIZED",
                "未授权，请先登录".to_string(),
            ),

            // 无权限 - 403
            AppError::Forbidden => (
                StatusCode::FORBIDDEN,
                "FORBIDDEN",
                "没有权限执行此操作".to_string(),
            ),

            // 资源冲突 - 409
            AppError::Conflict(msg) => {
                tracing::warn!("Conflict error: {}", msg);
                (StatusCode::CONFLICT, "CONFLICT", msg.clone())
            }

            // 请求体过大 - 413
            AppError::PayloadTooLarge(msg) => {
                tracing::warn!("Payload too large: {}", msg);
                (StatusCode::PAYLOAD_TOO_LARGE, "PAYLOAD_TOO_LARGE", msg.clone())
            }

            // 请求过于频繁 - 429
            AppError::RateLimit => {
                tracing::warn!("Rate limit exceeded");
                (
                    StatusCode::TOO_MANY_REQUESTS,
                    "RATE_LIMIT_EXCEEDED",
                    "请求过于频繁，请稍后再试".to_string(),
                )
            }

            // 内部错误 - 500
            AppError::Internal => {
                tracing::error!("Internal server error");
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "INTERNAL_ERROR",
                    "服务器内部错误，请稍后重试".to_string(),
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
