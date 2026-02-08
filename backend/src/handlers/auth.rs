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

use axum::extract::{Query, State};
use axum::response::Response;
use serde::Deserialize;
use serde_json::json;

use crate::extractors::AuthenticatedUser;
use crate::models::user::{
    ChangePasswordRequest, LoginRequest, RegisterRequest, SendEmailVerificationRequest,
    UpdateProfileRequest,
};
use crate::services::auth::AuthService;
use crate::utils::{json_response, success_response, AppError};
use crate::AppState;

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
    State(state): State<AppState>,
    axum::Json(req): axum::Json<RegisterRequest>,
) -> Result<Response, AppError> {
    let auth_service = AuthService::from_state(&state);

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
    State(state): State<AppState>,
    axum::Json(req): axum::Json<LoginRequest>,
) -> Result<Response, AppError> {
    let auth_service = AuthService::from_state(&state);

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
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
) -> Result<Response, AppError> {
    let auth_service = AuthService::from_state(&state);
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
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
    axum::Json(req): axum::Json<ChangePasswordRequest>,
) -> Result<Response, AppError> {
    let auth_service = AuthService::from_state(&state);

    auth_service
        .change_password(user_id, req.current_password, req.new_password)
        .await?;

    Ok(success_response("Password changed successfully"))
}

/// 更新用户资料（用户名、邮箱）
///
/// # 请求体
/// ```json
/// {
///   "username": "new_username",
///   "email": "new@example.com"
/// }
/// ```
///
/// # 响应
/// ```json
/// {
///   "user": {
///     "id": "...",
///     "username": "new_username",
///     "email": "new@example.com",
///     "created_at": "..."
///   }
/// }
/// ```
pub async fn update_profile_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
    axum::Json(req): axum::Json<UpdateProfileRequest>,
) -> Result<Response, AppError> {
    let auth_service = AuthService::from_state(&state);
    let user = auth_service.update_profile(user_id, req).await?;
    Ok(json_response(json!({ "user": user })))
}

#[derive(Debug, Deserialize)]
pub struct CheckProfileAvailabilityQuery {
    pub username: String,
    pub email: String,
}

/// 发送邮箱验证码（修改邮箱前需先校验邮箱有效）
///
/// # 请求体
/// ```json
/// { "email": "new@example.com" }
/// ```
pub async fn send_email_verification_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
    axum::Json(req): axum::Json<SendEmailVerificationRequest>,
) -> Result<Response, AppError> {
    let auth_service = AuthService::from_state(&state);
    auth_service
        .send_email_verification_code(user_id, req)
        .await?;
    Ok(success_response("验证码已发送"))
}

/// 检查用户名和邮箱是否可用（排除当前用户）
///
/// # Query
/// - `username`: 待检查的用户名
/// - `email`: 待检查的邮箱
///
/// # 响应
/// ```json
/// {
///   "username_available": true,
///   "email_available": false
/// }
/// ```
pub async fn check_profile_availability_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
    Query(params): Query<CheckProfileAvailabilityQuery>,
) -> Result<Response, AppError> {
    let auth_service = AuthService::from_state(&state);
    let (username_available, email_available) = auth_service
        .check_profile_availability(user_id, &params.username, &params.email)
        .await?;
    Ok(json_response(json!({
        "username_available": username_available,
        "email_available": email_available
    })))
}
