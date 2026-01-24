//! # Authentication Handlers
//!
//! 处理用户认证相关的 HTTP 请求，包括：
//! - 用户注册
//! - 用户登录
//! - 获取当前用户信息
//! - 修改密码
//!
//! ## 设计原则
//!
//! 1. **统一响应格式**: 使用 `utils::response` 中的辅助函数
//! 2. **业务逻辑分离**: 所有业务逻辑都在 `AuthService` 中
//! 3. **错误处理**: 使用 `AppError` 统一错误响应

use axum::extract::Extension;
use axum::response::Response;
use serde_json::json;
use sqlx::PgPool;
use std::sync::Arc;

use crate::config::Config;
use crate::extractors::AuthenticatedUser;
use crate::models::user::{ChangePasswordRequest, LoginRequest, RegisterRequest};
use crate::services::auth::AuthService;
use crate::utils::{json_response, success_response, AppError};

/// 创建 AuthService 实例的辅助函数
fn create_auth_service(pool: PgPool, config: &Config) -> AuthService {
    AuthService::new(pool, config.clone())
}

/// 用户注册
///
/// # 请求体
/// ```json
/// {
///   "username": "user123",
///   "email": "user@example.com",
///   "password": "securepassword"
/// }
/// ```
///
/// # 响应
/// ```json
/// {
///   "token": "jwt_token_here",
///   "user": {
///     "id": "...",
///     "username": "user123",
///     "email": "user@example.com"
///   }
/// }
/// ```
pub async fn register_handler(
    Extension(pool): Extension<PgPool>,
    Extension(config): Extension<Arc<Config>>,
    axum::Json(req): axum::Json<RegisterRequest>,
) -> Result<Response, AppError> {
    let auth_service = create_auth_service(pool, config.as_ref());

    // 注册用户
    let user = auth_service.register(req).await?;

    // 生成 JWT token
    let token = auth_service.generate_token(&user.id)?;

    Ok(json_response(json!({
        "token": token,
        "user": user
    })))
}

/// 用户登录
///
/// # 请求体
/// ```json
/// {
///   "email": "user@example.com",
///   "password": "securepassword"
/// }
/// ```
///
/// # 响应
/// ```json
/// {
///   "token": "jwt_token_here",
///   "user": {
///     "id": "...",
///     "username": "user123",
///     "email": "user@example.com"
///   }
/// }
/// ```
pub async fn login_handler(
    Extension(pool): Extension<PgPool>,
    Extension(config): Extension<Arc<Config>>,
    axum::Json(req): axum::Json<LoginRequest>,
) -> Result<Response, AppError> {
    let auth_service = create_auth_service(pool, config.as_ref());

    // 验证凭据并生成 token
    let token = auth_service.login(req).await?;

    // 从 token 中提取用户 ID（用于返回用户信息）
    let user_id = auth_service.verify_token(&token)?;
    let user = auth_service.get_user(user_id).await?;

    Ok(json_response(json!({
        "token": token,
        "user": user
    })))
}

/// 获取当前用户信息
///
/// 需要认证，从请求头中的 token 提取用户信息。
pub async fn me_handler(
    AuthenticatedUser(user_id): AuthenticatedUser,
    Extension(pool): Extension<PgPool>,
    Extension(config): Extension<Arc<Config>>,
) -> Result<Response, AppError> {
    let auth_service = create_auth_service(pool, config.as_ref());
    let user = auth_service.get_user(user_id).await?;
    Ok(json_response(json!({ "user": user })))
}

/// 修改密码
///
/// # 请求体
/// ```json
/// {
///   "current_password": "oldpassword",
///   "new_password": "newpassword"
/// }
/// ```
pub async fn change_password_handler(
    AuthenticatedUser(user_id): AuthenticatedUser,
    Extension(pool): Extension<PgPool>,
    Extension(config): Extension<Arc<Config>>,
    axum::Json(req): axum::Json<ChangePasswordRequest>,
) -> Result<Response, AppError> {
    let auth_service = create_auth_service(pool, config.as_ref());

    auth_service
        .change_password(user_id, req.current_password, req.new_password)
        .await?;

    Ok(success_response("Password changed successfully"))
}
