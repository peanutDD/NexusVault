//! 文件分类

use axum::extract::State;
use axum::response::Response;
use serde_json::json;

use crate::extractors::AuthenticatedUser;
use crate::services::file::FileService;
use crate::utils::{json_response, AppError};
use crate::AppState;

/// 获取文件分类列表
///
/// 返回用户所有文件的分类列表（去重）。
pub async fn categories_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
) -> Result<Response, AppError> {
    let file_service = FileService::from_state(&state);
    let categories = file_service.list_categories(user_id).await?;
    Ok(json_response(json!({ "categories": categories })))
}
