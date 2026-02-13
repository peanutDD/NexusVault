//! # Share Handlers
//!
//! 处理文件分享相关的 HTTP 请求，包括：
//! - 创建分享链接
//! - 访问分享文件
//! - 下载分享文件
//! - 删除分享链接
//! - 批量创建分享

use axum::extract::{Path, State};
use axum::response::Response;
use serde_json::json;
use uuid::Uuid;

use crate::extractors::AuthenticatedUser;
use crate::models::file::{AccessShareRequest, BatchShareRequest, CreateShareRequest};
use crate::services::share::ShareService;
use crate::utils::{file_response, json_response, success_response, AppError};
use crate::AppState;

/// 获取前端 URL（用于构建完整的分享链接）
fn get_frontend_url() -> String {
    std::env::var("FRONTEND_URL").unwrap_or_else(|_| "http://localhost:5173".to_string())
}

/// 创建文件分享链接
///
/// # 请求体
/// ```json
/// {
///   "file_id": "uuid",
///   "password": "optional_password",
///   "expires_in_days": 7,
///   "max_downloads": 10
/// }
/// ```
pub async fn create_share_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
    axum::Json(req): axum::Json<CreateShareRequest>,
) -> Result<Response, AppError> {
    let share_service = ShareService::from_state(&state);
    let share = share_service.create_share(user_id, req).await?;

    // 构建完整的分享 URL
    let base_url = get_frontend_url();
    let full_url = format!("{}{}", base_url, share.share_url);

    Ok(json_response(json!({
        "share": {
            "id": share.share_id,
            "url": full_url,
            "token": share.share_token,
            "expires_at": share.expires_at,
            "max_downloads": share.max_downloads,
        }
    })))
}

/// 访问分享文件（获取文件信息）
///
/// 验证分享 token 和密码（如果有），返回文件信息。
/// 注意：此端点不返回文件内容，只返回文件元数据。
pub async fn access_share_handler(
    State(state): State<AppState>,
    Path(token): Path<String>,
    axum::Json(req): axum::Json<AccessShareRequest>,
) -> Result<Response, AppError> {
    let share_service = ShareService::from_state(&state);

    // 获取分享信息
    let share = share_service.get_share_by_token(&token).await?;

    // 验证密码（如果需要）
    if let Some(password) = &req.password {
        if !share_service
            .verify_share_password(&share, password)
            .await?
        {
            return Err(AppError::Auth("密码错误".to_string()));
        }
    } else if share.password_hash.is_some() {
        return Err(AppError::Auth("需要密码".to_string()));
    }

    // 获取文件信息
    let file = state
        .file_service
        .get_file(share.file_id, share.user_id)
        .await?;

    // 增加下载计数
    share_service.increment_download_count(share.id).await?;

    // 返回文件信息（不包含文件内容）
    Ok(json_response(json!({
        "file": {
            "id": file.id,
            "filename": file.original_filename,
            "size": file.file_size,
            "mime_type": file.mime_type,
        },
        "share_token": token,
    })))
}

/// 下载分享的文件
///
/// 验证分享 token，返回文件内容。
/// 此端点会自动增加下载计数。
pub async fn download_shared_file_handler(
    State(state): State<AppState>,
    Path(token): Path<String>,
) -> Result<Response, AppError> {
    let share_service = ShareService::from_state(&state);

    // 获取分享信息（会自动验证过期和下载次数限制）
    let share = share_service.get_share_by_token(&token).await?;

    // 获取文件
    let file = state
        .file_service
        .get_file(share.file_id, share.user_id)
        .await?;
    let data = state.file_service.get_file_data(&file).await?;

    // 增加下载计数
    share_service.increment_download_count(share.id).await?;

    // 返回文件内容（触发下载）
    file_response(data, &file.original_filename, &file.mime_type, false)
        .map_err(|_| AppError::Internal)
}

/// 删除分享链接
pub async fn delete_share_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
    Path(share_id): Path<Uuid>,
) -> Result<Response, AppError> {
    let share_service = ShareService::from_state(&state);
    share_service.delete_share(share_id, user_id).await?;
    Ok(success_response("分享链接已删除"))
}

/// 批量创建分享链接
///
/// # 请求体
/// ```json
/// {
///   "file_ids": ["uuid1", "uuid2", ...],
///   "password": "optional_password",
///   "expires_in_days": 7,
///   "max_downloads": 10
/// }
/// ```
pub async fn batch_create_share_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
    axum::Json(req): axum::Json<BatchShareRequest>,
) -> Result<Response, AppError> {
    let share_service = ShareService::from_state(&state);
    let result = share_service.batch_create_share(user_id, req).await?;

    // 构建完整的分享 URL
    let base_url = get_frontend_url();
    let shares_with_urls: Vec<_> = result
        .shares
        .into_iter()
        .map(|share| {
            let full_url = format!("{}{}", base_url, share.share_url);
            json!({
                "id": share.share_id,
                "url": full_url,
                "token": share.share_token,
                "expires_at": share.expires_at,
                "max_downloads": share.max_downloads,
            })
        })
        .collect();

    // 构建响应消息
    let message = if result.failed.is_empty() {
        "所有文件分享成功".to_string()
    } else {
        format!(
            "{} 个文件分享成功，{} 个文件分享失败",
            shares_with_urls.len(),
            result.failed.len()
        )
    };

    Ok(json_response(json!({
        "shares": shares_with_urls,
        "failed": result.failed,
        "message": message
    })))
}
