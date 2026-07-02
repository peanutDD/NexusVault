//! 文件版本管理 API handlers

use axum::extract::{Path, Query, State};
use axum::response::Response;
use serde_json::json;
use std::collections::HashMap;
use uuid::Uuid;

use crate::extractors::AuthenticatedUser;
use crate::models::file::{RestoreVersionRequest, UpdateVersionLabelRequest};
use crate::services::activity::{AuditEventInput, AuditService};
use crate::utils::{file_response, json_response, AppError};
use crate::AppState;

/// 获取文件的所有版本列表
pub async fn list_file_versions_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
    Path(file_id): Path<Uuid>,
) -> Result<Response, AppError> {
    let current = state.file_service.get_file(file_id, user_id).await?;
    let versions = state
        .file_service
        .list_file_versions(file_id, user_id)
        .await?;
    let versions: Vec<_> = versions
        .into_iter()
        .map(|version| {
            let can_text = is_text_like(&version.mime_type, &version.original_filename);
            json!({
                "id": version.id,
                "file_id": version.file_id,
                "version_number": version.version_number,
                "filename": version.filename,
                "original_filename": version.original_filename,
                "file_size": version.file_size,
                "mime_type": version.mime_type,
                "label": version.label,
                "created_at": version.created_at,
                "can_diff": can_text,
                "can_preview": can_preview(&version.mime_type, &version.original_filename),
            })
        })
        .collect();
    Ok(json_response(json!({
        "current": {
            "id": current.id,
            "filename": current.filename,
            "original_filename": current.original_filename,
            "file_size": current.file_size,
            "mime_type": current.mime_type,
            "updated_at": current.updated_at,
        },
        "versions": versions
    })))
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

pub async fn download_file_version_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
    Path(version_id): Path<Uuid>,
) -> Result<Response, AppError> {
    let version = state
        .file_service
        .get_file_version_entity(version_id, user_id)
        .await?;
    let data = state.storage.get_file(&version.file_path).await?;
    file_response(data, &version.original_filename, &version.mime_type, false)
        .map_err(|_| AppError::Internal)
}

pub async fn preview_file_version_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
    Path(version_id): Path<Uuid>,
) -> Result<Response, AppError> {
    let version = state
        .file_service
        .get_file_version_entity(version_id, user_id)
        .await?;
    let data = state.storage.get_file(&version.file_path).await?;
    file_response(data, &version.original_filename, &version.mime_type, true)
        .map_err(|_| AppError::Internal)
}

pub async fn diff_file_version_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
    Path((file_id, version_id)): Path<(Uuid, Uuid)>,
    Query(_query): Query<HashMap<String, String>>,
) -> Result<Response, AppError> {
    let current = state.file_service.get_file(file_id, user_id).await?;
    let version = state
        .file_service
        .get_file_version_entity(version_id, user_id)
        .await?;
    if version.file_id != file_id {
        return Err(AppError::NotFound);
    }
    if !is_text_like(&current.mime_type, &current.original_filename)
        || !is_text_like(&version.mime_type, &version.original_filename)
    {
        return Err(AppError::Validation("该版本不支持文本 diff".to_string()));
    }
    let old =
        String::from_utf8_lossy(&state.storage.get_file(&version.file_path).await?).into_owned();
    let new =
        String::from_utf8_lossy(&state.storage.get_file(&current.file_path).await?).into_owned();
    Ok(json_response(json!({ "diff": simple_diff(&old, &new) })))
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
    let current = state.file_service.get_file(file_id, user_id).await?;
    let version = state
        .file_service
        .get_file_version_entity(version_id, user_id)
        .await?;
    state
        .file_service
        .restore_version(file_id, version_id, user_id, req)
        .await?;
    AuditService::from_state(&state)
        .record(AuditEventInput {
            user_id,
            actor_type: "user",
            actor_user_id: Some(user_id),
            source: "web",
            event_type: "file.version_restored",
            target_type: "file",
            file_id: Some(file_id),
            folder_id: current.folder_id,
            share_id: None,
            file_request_id: None,
            api_token_id: None,
            status: Some(200),
            ip_address: None,
            user_agent: None,
            metadata: json!({
                "filename": current.original_filename,
                "version_id": version.id,
                "version_number": version.version_number,
                "version_filename": version.original_filename,
            }),
        })
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

fn is_text_like(mime_type: &str, filename: &str) -> bool {
    let lower = filename.to_ascii_lowercase();
    mime_type.starts_with("text/")
        || mime_type == "application/json"
        || lower.ends_with(".md")
        || lower.ends_with(".txt")
        || lower.ends_with(".json")
}

fn can_preview(mime_type: &str, filename: &str) -> bool {
    is_text_like(mime_type, filename)
        || mime_type.starts_with("image/")
        || mime_type == "application/pdf"
        || mime_type.starts_with("video/")
        || mime_type.starts_with("audio/")
}

fn simple_diff(old: &str, new: &str) -> String {
    if old == new {
        return String::new();
    }
    let mut out = String::new();
    for line in old.lines() {
        out.push('-');
        out.push_str(line);
        out.push('\n');
    }
    for line in new.lines() {
        out.push('+');
        out.push_str(line);
        out.push('\n');
    }
    out
}
