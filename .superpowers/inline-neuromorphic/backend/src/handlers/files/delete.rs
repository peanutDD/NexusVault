//! 单文件删除

use axum::extract::{Path, State};
use axum::response::Response;
use uuid::Uuid;

use crate::extractors::AuthenticatedUser;
use crate::services::activity::{AuditEventInput, AuditService};
use crate::utils::{success_response, AppError};
use crate::AppState;

/// 删除文件
pub async fn delete_file_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
    Path(file_id): Path<Uuid>,
) -> Result<Response, AppError> {
    let file = state.file_service.get_file(file_id, user_id).await?;
    state.file_service.delete_file(file_id, user_id).await?;
    AuditService::from_state(&state)
        .record(AuditEventInput {
            user_id,
            actor_type: "user",
            actor_user_id: Some(user_id),
            source: "web",
            event_type: "file.deleted",
            target_type: "file",
            file_id: Some(file_id),
            folder_id: file.folder_id,
            share_id: None,
            file_request_id: None,
            api_token_id: None,
            status: Some(200),
            ip_address: None,
            user_agent: None,
            metadata: serde_json::json!({
                "filename": file.original_filename,
            }),
        })
        .await?;
    if let Some(pool) = &state.redis {
        let _ = crate::services::redis::RedisService::new(pool.clone())
            .bump_user_cache_version(user_id)
            .await;
    }
    Ok(success_response("File deleted successfully"))
}
