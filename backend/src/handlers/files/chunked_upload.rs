//! 分块上传（可恢复上传）
//!
//! 这里仅负责 HTTP 层：
//! - 参数解析（Path/Query/Body）
//! - 返回统一 JSON 响应
//!
//! 业务逻辑（会话管理、分块落盘/上传、合并、清理）由 `FileService` 承担。

use axum::extract::{Path, Query, State};
use axum::response::Response;
use bytes::Bytes;
use serde_json::json;
use std::collections::HashMap;
use uuid::Uuid;

use crate::extractors::AuthenticatedUser;
use crate::models::upload_session::{CompleteChunkedUploadRequest, InitChunkedUploadRequest};
use crate::services::file::FileService;
use crate::utils::{json_response, parse_part_number, success_response, AppError};
use crate::AppState;

/// 初始化分块上传会话
///
/// 创建上传会话，返回上传 ID、分块大小和总分块数。
///
/// # 请求体
/// ```json
/// {
///   "filename": "large-file.zip",
///   "mime_type": "application/zip",
///   "total_size": 104857600
/// }
/// ```
pub async fn chunked_upload_init_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
    axum::Json(req): axum::Json<InitChunkedUploadRequest>,
) -> Result<Response, AppError> {
    let file_service = FileService::from_state(&state);
    let (upload_id, chunk_size, total_parts) =
        file_service.init_chunked_upload(user_id, req).await?;
    Ok(json_response(json!({
        "upload_id": upload_id,
        "chunk_size": chunk_size,
        "total_parts": total_parts,
    })))
}

/// 上传分块
///
/// # 路径参数
/// - `upload_id`: 上传会话 ID
///
/// # 查询参数
/// - `part`: 分块索引（从 1 开始）
///
/// # 请求体
/// 分块的二进制数据
pub async fn chunked_upload_chunk_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
    Path(upload_id): Path<Uuid>,
    Query(params): Query<HashMap<String, String>>,
    body: Bytes,
) -> Result<Response, AppError> {
    let file_service = FileService::from_state(&state);

    // 解析分块索引
    let part = parse_part_number(&params)?;

    // 上传分块
    file_service
        .upload_chunk(upload_id, user_id, part, body)
        .await?;

    Ok(json_response(json!({ "ok": true, "part": part })))
}

/// 查询分块上传状态
///
/// 返回已上传的分块列表和总分块数，用于断点续传。
pub async fn chunked_upload_status_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
    Path(upload_id): Path<Uuid>,
) -> Result<Response, AppError> {
    let file_service = FileService::from_state(&state);
    let (uploaded_parts, total_parts) = file_service
        .chunked_upload_status(upload_id, user_id)
        .await?;
    Ok(json_response(json!({
        "upload_id": upload_id,
        "uploaded_parts": uploaded_parts,
        "total_parts": total_parts,
    })))
}

/// 完成分块上传
///
/// 合并所有分块，创建文件记录，清理临时文件。
pub async fn chunked_upload_complete_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
    Path(upload_id): Path<Uuid>,
    axum::Json(req): axum::Json<CompleteChunkedUploadRequest>,
) -> Result<Response, AppError> {
    let file_service = FileService::from_state(&state);
    let file = file_service
        .complete_chunked_upload(upload_id, user_id, req)
        .await?;
    Ok(json_response(json!({ "file": file })))
}

/// 取消分块上传
///
/// 删除上传会话和所有临时文件。
pub async fn chunked_upload_abort_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
    Path(upload_id): Path<Uuid>,
) -> Result<Response, AppError> {
    let file_service = FileService::from_state(&state);
    file_service
        .abort_chunked_upload(upload_id, user_id)
        .await?;
    Ok(success_response("Upload aborted"))
}
