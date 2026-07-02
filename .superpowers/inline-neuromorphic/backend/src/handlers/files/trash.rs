//! 回收站文件操作

use axum::extract::{Path, State};
use axum::response::Response;
use serde_json::json;
use uuid::Uuid;

use crate::extractors::AuthenticatedUser;
use crate::models::file::BatchDeleteRequest;
use crate::services::activity::{AuditEventInput, AuditService};
use crate::utils::{json_response, success_response, AppError};
use crate::AppState;

async fn bump_files_cache(state: &AppState, user_id: Uuid) {
    if let Some(pool) = &state.redis {
        let _ = crate::services::redis::RedisService::new(pool.clone())
            .bump_user_cache_version(user_id)
            .await;
    }
}

pub async fn list_trash_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
) -> Result<Response, AppError> {
    let files = state.file_service.list_trash(user_id).await?;
    Ok(json_response(json!({ "files": files })))
}

pub async fn restore_file_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
    Path(file_id): Path<Uuid>,
) -> Result<Response, AppError> {
    let file = state.file_service.restore_file(file_id, user_id).await?;
    AuditService::from_state(&state)
        .record(AuditEventInput {
            user_id,
            actor_type: "user",
            actor_user_id: Some(user_id),
            source: "web",
            event_type: "file.restored",
            target_type: "file",
            file_id: Some(file.id),
            folder_id: file.folder_id,
            share_id: None,
            file_request_id: None,
            api_token_id: None,
            status: Some(200),
            ip_address: None,
            user_agent: None,
            metadata: json!({ "filename": file.original_filename }),
        })
        .await?;
    bump_files_cache(&state, user_id).await;
    Ok(json_response(json!({ "file": file })))
}

pub async fn batch_restore_files_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
    axum::Json(req): axum::Json<BatchDeleteRequest>,
) -> Result<Response, AppError> {
    let result = state
        .file_service
        .batch_restore_files(&req.ids, user_id)
        .await?;
    AuditService::from_state(&state)
        .record(AuditEventInput {
            user_id,
            actor_type: "user",
            actor_user_id: Some(user_id),
            source: "web",
            event_type: "file.batch_restored",
            target_type: "file_batch",
            file_id: None,
            folder_id: None,
            share_id: None,
            file_request_id: None,
            api_token_id: None,
            status: Some(200),
            ip_address: None,
            user_agent: None,
            metadata: json!({
                "requested_file_ids": req.ids,
                "restored": result.succeeded,
                "failed": result.failed,
            }),
        })
        .await?;
    if result.succeeded > 0 || !result.failed.is_empty() {
        bump_files_cache(&state, user_id).await;
    }
    Ok(json_response(json!({
        "restored": result.succeeded,
        "failed": result.failed
    })))
}

pub async fn permanently_delete_file_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
    Path(file_id): Path<Uuid>,
) -> Result<Response, AppError> {
    let file = sqlx::query_as::<_, (String, Option<Uuid>)>(
        "SELECT original_filename, folder_id FROM files WHERE id = $1 AND user_id = $2",
    )
    .bind(file_id)
    .bind(user_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(AppError::from)?;
    state
        .file_service
        .permanently_delete_file(file_id, user_id)
        .await?;
    AuditService::from_state(&state)
        .record(AuditEventInput {
            user_id,
            actor_type: "user",
            actor_user_id: Some(user_id),
            source: "web",
            event_type: "file.permanently_deleted",
            target_type: "file",
            file_id: Some(file_id),
            folder_id: file.as_ref().and_then(|(_, folder_id)| *folder_id),
            share_id: None,
            file_request_id: None,
            api_token_id: None,
            status: Some(200),
            ip_address: None,
            user_agent: None,
            metadata: json!({
                "filename": file.map(|(filename, _)| filename),
            }),
        })
        .await?;
    bump_files_cache(&state, user_id).await;
    Ok(success_response("File permanently deleted"))
}

pub async fn batch_permanently_delete_files_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
    axum::Json(req): axum::Json<BatchDeleteRequest>,
) -> Result<Response, AppError> {
    let result = state
        .file_service
        .batch_permanently_delete_files(&req.ids, user_id)
        .await?;
    AuditService::from_state(&state)
        .record(AuditEventInput {
            user_id,
            actor_type: "user",
            actor_user_id: Some(user_id),
            source: "web",
            event_type: "file.batch_permanently_deleted",
            target_type: "file_batch",
            file_id: None,
            folder_id: None,
            share_id: None,
            file_request_id: None,
            api_token_id: None,
            status: Some(200),
            ip_address: None,
            user_agent: None,
            metadata: json!({
                "requested_file_ids": req.ids,
                "deleted": result.succeeded,
                "failed": result.failed,
            }),
        })
        .await?;
    if result.succeeded > 0 || !result.failed.is_empty() {
        bump_files_cache(&state, user_id).await;
    }
    Ok(json_response(json!({
        "deleted": result.succeeded,
        "failed": result.failed
    })))
}

pub async fn empty_trash_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
) -> Result<Response, AppError> {
    let deleted = state.file_service.empty_trash(user_id).await?;
    AuditService::from_state(&state)
        .record(AuditEventInput {
            user_id,
            actor_type: "user",
            actor_user_id: Some(user_id),
            source: "web",
            event_type: "trash.emptied",
            target_type: "trash",
            file_id: None,
            folder_id: None,
            share_id: None,
            file_request_id: None,
            api_token_id: None,
            status: Some(200),
            ip_address: None,
            user_agent: None,
            metadata: json!({ "deleted": deleted }),
        })
        .await?;
    bump_files_cache(&state, user_id).await;
    Ok(json_response(json!({
        "deleted": deleted,
        "message": "Trash emptied"
    })))
}
