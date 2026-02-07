//! 秒传（文件指纹）HTTP 层
//!
//! 客户端传 content_sha256 + filename + file_size + mime_type；
//! 若服务器已有相同内容则直接创建文件记录并返回，无需上传内容。

use axum::extract::State;
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::Json;
use serde_json::json;

use crate::extractors::AuthenticatedUser;
use crate::models::file::InstantUploadRequest;
use crate::services::file::FileService;
use crate::utils::AppError;
use crate::AppState;

/// 秒传：按文件指纹创建文件记录（不传文件内容）
///
/// # 请求体
/// ```json
/// {
///   "content_sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
///   "filename": "my-file.zip",
///   "file_size": 1024,
///   "mime_type": "application/zip",
///   "folder_id": null
/// }
/// ```
///
/// - 若服务器已有相同 content_sha256 + file_size 的文件：201 返回 { "file": ... }，复用存储
/// - 若无：200 返回 { "instant": false }，避免浏览器 console 将 404 标为错误；客户端走普通/分片上传
pub async fn instant_upload_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
    axum::Json(req): axum::Json<InstantUploadRequest>,
) -> Result<axum::response::Response, AppError> {
    let file_service = FileService::from_state(&state);
    let result = file_service.instant_upload(user_id, req).await?;
    match result {
        Some(file) => Ok((StatusCode::CREATED, Json(json!({ "file": file }))).into_response()),
        None => Ok((StatusCode::OK, Json(json!({ "instant": false }))).into_response()),
    }
}
