use axum::extract::{Path, State};
use axum::response::Response;
use serde_json::json;
use uuid::Uuid;

use crate::extractors::AuthenticatedUser;
use crate::services::activity::{AuditEventInput, AuditService};
use crate::types::file::UpdateFileFlagsRequest;
use crate::types::tag::{BatchTagsRequest, SetFileTagsRequest};
use crate::utils::{json_response, success_response, AppError};
use crate::AppState;

pub async fn set_file_tags_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
    Path(file_id): Path<Uuid>,
    axum::Json(req): axum::Json<SetFileTagsRequest>,
) -> Result<Response, AppError> {
    let file = state.file_service.get_file(file_id, user_id).await?;
    replace_file_tags(&state, user_id, &[file_id], &req.tag_ids).await?;
    AuditService::from_state(&state)
        .record(AuditEventInput {
            user_id,
            actor_type: "user",
            actor_user_id: Some(user_id),
            source: "web",
            event_type: "file.tags_updated",
            target_type: "file",
            file_id: Some(file_id),
            folder_id: file.folder_id,
            share_id: None,
            file_request_id: None,
            api_token_id: None,
            status: Some(200),
            ip_address: None,
            user_agent: None,
            metadata: json!({
                "filename": file.original_filename,
                "tag_ids": req.tag_ids,
            }),
        })
        .await?;
    Ok(success_response("文件标签已更新"))
}

pub async fn batch_tags_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
    axum::Json(req): axum::Json<BatchTagsRequest>,
) -> Result<Response, AppError> {
    let files = sqlx::query_as::<_, (Uuid, String, Option<Uuid>)>(
        "SELECT id, original_filename, folder_id
         FROM files
         WHERE user_id = $1 AND id = ANY($2) AND deleted_at IS NULL",
    )
    .bind(user_id)
    .bind(&req.file_ids)
    .fetch_all(&state.pool)
    .await
    .map_err(AppError::from)?;
    replace_file_tags(&state, user_id, &req.file_ids, &req.tag_ids).await?;
    let audit = AuditService::from_state(&state);
    for (file_id, filename, folder_id) in files {
        audit
            .record(AuditEventInput {
                user_id,
                actor_type: "user",
                actor_user_id: Some(user_id),
                source: "web",
                event_type: "file.tags_updated",
                target_type: "file",
                file_id: Some(file_id),
                folder_id,
                share_id: None,
                file_request_id: None,
                api_token_id: None,
                status: Some(200),
                ip_address: None,
                user_agent: None,
                metadata: json!({
                    "filename": filename,
                    "tag_ids": req.tag_ids,
                    "batch": true,
                }),
            })
            .await?;
    }
    Ok(json_response(json!({ "updated": req.file_ids.len() })))
}

async fn replace_file_tags(
    state: &AppState,
    user_id: Uuid,
    file_ids: &[Uuid],
    tag_ids: &[Uuid],
) -> Result<(), AppError> {
    if file_ids.is_empty() {
        return Ok(());
    }
    let owned_files: i64 = sqlx::query_scalar(
        "SELECT COUNT(*)::BIGINT FROM files WHERE user_id = $1 AND id = ANY($2) AND deleted_at IS NULL",
    )
    .bind(user_id)
    .bind(file_ids)
    .fetch_one(&state.pool)
    .await
    .map_err(AppError::from)?;
    if owned_files != file_ids.len() as i64 {
        return Err(AppError::NotFound);
    }
    if !tag_ids.is_empty() {
        let owned_tags: i64 = sqlx::query_scalar(
            "SELECT COUNT(*)::BIGINT FROM file_tags WHERE user_id = $1 AND id = ANY($2)",
        )
        .bind(user_id)
        .bind(tag_ids)
        .fetch_one(&state.pool)
        .await
        .map_err(AppError::from)?;
        if owned_tags != tag_ids.len() as i64 {
            return Err(AppError::NotFound);
        }
    }

    let mut tx = state.pool.begin().await.map_err(AppError::from)?;
    sqlx::query("DELETE FROM file_tag_assignments WHERE user_id = $1 AND file_id = ANY($2)")
        .bind(user_id)
        .bind(file_ids)
        .execute(&mut *tx)
        .await
        .map_err(AppError::from)?;
    for file_id in file_ids {
        for tag_id in tag_ids {
            sqlx::query(
                "INSERT INTO file_tag_assignments (user_id, file_id, tag_id)
                 VALUES ($1, $2, $3)
                 ON CONFLICT DO NOTHING",
            )
            .bind(user_id)
            .bind(*file_id)
            .bind(*tag_id)
            .execute(&mut *tx)
            .await
            .map_err(AppError::from)?;
        }
    }
    tx.commit().await.map_err(AppError::from)?;
    Ok(())
}

pub async fn update_file_flags_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
    Path(file_id): Path<Uuid>,
    axum::Json(req): axum::Json<UpdateFileFlagsRequest>,
) -> Result<Response, AppError> {
    let file = state.file_service.get_file(file_id, user_id).await?;
    let row = sqlx::query(
        "UPDATE files
         SET is_favorite = COALESCE($1, is_favorite),
             is_pinned = COALESCE($2, is_pinned),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3 AND user_id = $4 AND deleted_at IS NULL",
    )
    .bind(req.is_favorite)
    .bind(req.is_pinned)
    .bind(file_id)
    .bind(user_id)
    .execute(&state.pool)
    .await
    .map_err(AppError::from)?;
    if row.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    AuditService::from_state(&state)
        .record(AuditEventInput {
            user_id,
            actor_type: "user",
            actor_user_id: Some(user_id),
            source: "web",
            event_type: "file.flags_updated",
            target_type: "file",
            file_id: Some(file_id),
            folder_id: file.folder_id,
            share_id: None,
            file_request_id: None,
            api_token_id: None,
            status: Some(200),
            ip_address: None,
            user_agent: None,
            metadata: json!({
                "filename": file.original_filename,
                "is_favorite": req.is_favorite,
                "is_pinned": req.is_pinned,
            }),
        })
        .await?;
    Ok(success_response("文件状态已更新"))
}
