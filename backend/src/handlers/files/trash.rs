//! 回收站文件操作

use axum::extract::{Path, State};
use axum::response::Response;
use serde_json::json;
use uuid::Uuid;

use crate::extractors::AuthenticatedUser;
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
    bump_files_cache(&state, user_id).await;
    Ok(json_response(json!({ "file": file })))
}

pub async fn permanently_delete_file_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
    Path(file_id): Path<Uuid>,
) -> Result<Response, AppError> {
    state
        .file_service
        .permanently_delete_file(file_id, user_id)
        .await?;
    bump_files_cache(&state, user_id).await;
    Ok(success_response("File permanently deleted"))
}

pub async fn empty_trash_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
) -> Result<Response, AppError> {
    let deleted = state.file_service.empty_trash(user_id).await?;
    bump_files_cache(&state, user_id).await;
    Ok(json_response(json!({
        "deleted": deleted,
        "message": "Trash emptied"
    })))
}
