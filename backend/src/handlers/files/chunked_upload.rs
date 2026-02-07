//! 分块上传（可恢复上传）
//!
//! 这里仅负责 HTTP 层：
//! - 参数解析（Path/Query/Body）
//! - 返回统一 JSON 响应
//!
//! 业务逻辑（会话管理、分块落盘/上传、合并、清理）由 `FileService` 承担。

use axum::extract::{Path, Query, State};
use axum::http::HeaderMap;
use axum::response::Response;
use bytes::Bytes;
use serde_json::json;
use std::collections::HashMap;
use uuid::Uuid;

use crate::constants::MAX_CONCURRENT_CHUNKED_UPLOADS;
use crate::extractors::AuthenticatedUser;
use crate::models::upload_session::{CompleteChunkedUploadRequest, InitChunkedUploadRequest};
use crate::services::file::FileService;
use crate::utils::{json_response, parse_part_number, success_response, AppError};
use crate::AppState;

/// 分块上传时可选：请求头 X-Part-SHA256 为当前分块的 SHA-256 十六进制，服务端校验通过才接受
const HEADER_PART_SHA256: &str = "x-part-sha256";

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
    tracing::info!(
        user_id = %user_id,
        filename = %req.filename,
        total_size = req.total_size,
        "POST /upload/chunked/init"
    );
    let file_service = FileService::from_state(&state);
    let (upload_id, chunk_size, total_parts) =
        file_service.init_chunked_upload(user_id, req).await?;
    Ok(json_response(json!({
        "upload_id": upload_id,
        "chunk_size": chunk_size,
        "total_parts": total_parts,
        "max_concurrent_chunked_uploads": MAX_CONCURRENT_CHUNKED_UPLOADS,
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
/// # 请求头（可选）
/// - `X-Part-SHA256`: 当前分块内容的 SHA-256 十六进制，服务端校验不通过则 400
///
/// # 请求体
/// 分块的二进制数据
pub async fn chunked_upload_chunk_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
    Path(upload_id): Path<Uuid>,
    Query(params): Query<HashMap<String, String>>,
    headers: HeaderMap,
    body: Bytes,
) -> Result<Response, AppError> {
    let file_service = FileService::from_state(&state);

    let part = parse_part_number(&params)?;
    let part_sha256 = headers
        .get(HEADER_PART_SHA256)
        .and_then(|v| v.to_str().ok())
        .map(|s| s.trim().to_string());

    tracing::info!(
        upload_id = %upload_id,
        part,
        body_len = body.len(),
        "PUT /upload/chunked/:id/chunk"
    );
    file_service
        .upload_chunk(upload_id, user_id, part, body, part_sha256.as_deref())
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
    tracing::debug!(upload_id = %upload_id, "GET /upload/chunked/:id/status");
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
    tracing::info!(upload_id = %upload_id, "POST /upload/chunked/:id/complete");
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
    tracing::info!(upload_id = %upload_id, "DELETE /upload/chunked/:id/abort");
    let file_service = FileService::from_state(&state);
    file_service
        .abort_chunked_upload(upload_id, user_id)
        .await?;
    Ok(success_response("Upload aborted"))
}
