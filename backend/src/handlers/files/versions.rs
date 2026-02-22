//! 文件版本管理 API handlers

use axum::extract::{Path, State};
use axum::response::Response;
use serde_json::json;
use uuid::Uuid;

use crate::extractors::AuthenticatedUser;
use crate::models::file::{RestoreVersionRequest, UpdateVersionLabelRequest};
use crate::utils::{json_response, AppError};
use crate::AppState;

/// 获取文件的所有版本列表
pub async fn list_file_versions_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
    Path(file_id): Path<Uuid>,
) -> Result<Response, AppError> {
    let versions = state
        .file_service
        .list_file_versions(file_id, user_id)
        .await?;
    Ok(json_response(json!({ "versions": versions })))
}

/// 获取指定版本详情
pub async fn get_file_version_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
    Path(version_id): Path<Uuid>,
) -> Result<Response, AppError> {
    let version = state
        .file_service
        .get_file_version(version_id, user_id)
        .await?;
    Ok(json_response(json!({ "version": version })))
}

/// 更新版本标签
pub async fn update_version_label_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
    Path(version_id): Path<Uuid>,
    axum::extract::Json(req): axum::extract::Json<UpdateVersionLabelRequest>,
) -> Result<Response, AppError> {
    state
        .file_service
        .update_version_label(version_id, user_id, req)
        .await?;
    Ok(json_response(json!({ "message": "版本标签已更新" })))
}

/// 恢复版本
pub async fn restore_version_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
    Path((file_id, version_id)): Path<(Uuid, Uuid)>,
    axum::extract::Json(req): axum::extract::Json<RestoreVersionRequest>,
) -> Result<Response, AppError> {
    state
        .file_service
        .restore_version(file_id, version_id, user_id, req)
        .await?;
    if let Some(pool) = &state.redis {
        let _ = crate::services::redis::RedisService::new(pool.clone())
            .bump_user_cache_version(user_id)
            .await;
    }
    Ok(json_response(json!({ "message": "版本已恢复" })))
}

/// 删除指定版本
pub async fn delete_version_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
    Path(version_id): Path<Uuid>,
) -> Result<Response, AppError> {
    state
        .file_service
        .delete_version(version_id, user_id)
        .await?;
    Ok(json_response(json!({ "message": "版本已删除" })))
}
