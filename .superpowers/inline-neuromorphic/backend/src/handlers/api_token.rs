//! # API Token Handlers
//!
//! 处理 API Token 相关的 HTTP 请求，包括：
//! - 创建 API Token
//! - 列出用户的 API Token
//! - 删除 API Token
//!
//! ## 设计原则
//!
//! 1. **统一响应格式**: 使用 `utils::response` 中的辅助函数
//! 2. **业务逻辑分离**: 所有业务逻辑都在 `ApiTokenService` 中
//! 3. **输入验证**: 使用 `validator` crate 进行请求验证

use axum::extract::{Path, State};
use axum::response::Response;
use chrono::Utc;
use serde_json::json;
use uuid::Uuid;

use crate::extractors::AuthenticatedUser;
use crate::models::api_token::{
    ApiTokenResponse, CreateApiTokenRequest, CreateWebDavWizardTokenRequest, UpdateApiTokenRequest,
};
use crate::repositories::WebDavAccessEventsRepo;
use crate::services::api_token::ApiTokenService;
use crate::utils::{json_response, success_response, AppError};
use crate::AppState;

/// 创建新的 API Token
///
/// # 请求体
/// ```json
/// {
///   "name": "My API Token",
///   "expires_in_days": 30
/// }
/// ```
///
/// # 响应
/// ```json
/// {
///   "token": {
///     "id": "...",
///     "name": "My API Token",
///     "token": "actual_token_string",
///     "expires_at": "...",
///     "created_at": "..."
///   }
/// }
/// ```
///
/// **注意**: Token 只在创建时返回一次，请妥善保存。
pub async fn create_token_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
    axum::Json(req): axum::Json<CreateApiTokenRequest>,
) -> Result<Response, AppError> {
    let token_service = ApiTokenService::from_state(&state);

    // 验证请求数据
    validator::Validate::validate(&req)
        .map_err(|e| AppError::Validation(format!("Validation error: {}", e)))?;

    // 创建 token
    let (token, api_token) = token_service.create_token(user_id, req).await?;

    Ok(json_response(json!({
        "token": ApiTokenResponse {
            id: api_token.id,
            name: api_token.name,
            token,
            expires_at: api_token.expires_at,
            created_at: api_token.created_at,
            webdav_enabled: api_token.webdav_enabled,
            webdav_read_only: api_token.webdav_read_only,
            webdav_root_folder_id: api_token.webdav_root_folder_id,
        }
    })))
}

/// 列出当前用户的所有 API Token
///
/// 返回用户创建的所有 API Token（不包含 token 值，仅元数据）。
pub async fn list_tokens_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
) -> Result<Response, AppError> {
    let token_service = ApiTokenService::from_state(&state);
    let tokens = token_service.list_tokens(user_id).await?;
    Ok(json_response(json!({ "tokens": tokens })))
}

/// Creates a WebDAV-ready read/write token for the setup wizard.
///
/// The raw token is returned once, matching normal API token behavior. It is
/// not stored and cannot be recovered later.
pub async fn create_webdav_wizard_token_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
    req: Option<axum::Json<CreateWebDavWizardTokenRequest>>,
) -> Result<Response, AppError> {
    let token_service = ApiTokenService::from_state(&state);
    let req = req
        .map(|json| json.0)
        .unwrap_or(CreateWebDavWizardTokenRequest {
            name: None,
            webdav_read_only: None,
            webdav_root_folder_id: None,
        });
    validator::Validate::validate(&req)
        .map_err(|e| AppError::Validation(format!("Validation error: {}", e)))?;

    let req = CreateApiTokenRequest {
        name: req
            .name
            .map(|name| name.trim().to_string())
            .filter(|name| !name.is_empty())
            .unwrap_or_else(|| format!("WebDAV setup {}", Utc::now().format("%Y-%m-%d"))),
        expires_in_days: Some(90),
        webdav_enabled: Some(true),
        webdav_read_only: Some(req.webdav_read_only.unwrap_or(false)),
        webdav_root_folder_id: req.webdav_root_folder_id,
    };

    let (token, api_token) = token_service.create_token(user_id, req).await?;

    Ok(json_response(json!({
        "token": ApiTokenResponse {
            id: api_token.id,
            name: api_token.name,
            token,
            expires_at: api_token.expires_at,
            created_at: api_token.created_at,
            webdav_enabled: api_token.webdav_enabled,
            webdav_read_only: api_token.webdav_read_only,
            webdav_root_folder_id: api_token.webdav_root_folder_id,
        }
    })))
}

pub async fn update_token_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
    Path(token_id): Path<Uuid>,
    axum::Json(req): axum::Json<UpdateApiTokenRequest>,
) -> Result<Response, AppError> {
    validator::Validate::validate(&req)
        .map_err(|e| AppError::Validation(format!("Validation error: {}", e)))?;

    let token_service = ApiTokenService::from_state(&state);
    let token = token_service.update_token(token_id, user_id, req).await?;

    Ok(json_response(json!({ "token": token })))
}

/// Returns recent WebDAV access events for the authenticated user.
pub async fn list_webdav_activity_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
) -> Result<Response, AppError> {
    let events = WebDavAccessEventsRepo::new(&state.pool)
        .list_recent_by_user(user_id, 20)
        .await?;

    Ok(json_response(json!({ "events": events })))
}

pub async fn list_webdav_diagnostics_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
) -> Result<Response, AppError> {
    let diagnostics = WebDavAccessEventsRepo::new(&state.pool)
        .list_diagnostics_by_user(user_id)
        .await?;

    Ok(json_response(json!({ "diagnostics": diagnostics })))
}

/// 删除 API Token
///
/// 删除指定的 API Token，删除后该 token 将立即失效。
pub async fn delete_token_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
    Path(token_id): Path<Uuid>,
) -> Result<Response, AppError> {
    let token_service = ApiTokenService::from_state(&state);
    token_service.delete_token(token_id, user_id).await?;
    Ok(success_response("Token deleted successfully"))
}
