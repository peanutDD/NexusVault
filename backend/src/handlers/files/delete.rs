//! 单文件删除

use axum::extract::{Path, State};
use axum::response::Response;
use uuid::Uuid;

use crate::extractors::AuthenticatedUser;
use crate::utils::{success_response, AppError};
use crate::AppState;

/// 删除文件
pub async fn delete_file_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
    Path(file_id): Path<Uuid>,
) -> Result<Response, AppError> {
    state.file_service.delete_file(file_id, user_id).await?;
    if let Some(pool) = &state.redis {
        let _ = crate::services::redis::RedisService::new(pool.clone())
            .bump_user_cache_version(user_id)
            .await;
    }
    Ok(success_response("File deleted successfully"))
}
