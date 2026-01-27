//! # File Handlers
//!
//! 处理文件相关的 HTTP 请求，包括：
//! - 文件上传（普通和分块上传）
//! - 文件列表和查询
//! - 文件下载和预览
//! - 文件删除（单个和批量）
//! - 文件分类管理
//! - 存储配额查询
//!
//! ## 设计原则
//!
//! 1. **职责单一**: 每个 handler 只负责 HTTP 请求处理和响应构建
//! 2. **业务逻辑分离**: 所有业务逻辑都在 `FileService` 中
//! 3. **统一认证**: 使用 `AuthenticatedUser` extractor 自动处理认证
//! 4. **统一响应**: 使用 `utils::response` 中的辅助函数构建响应

use axum::extract::{Multipart, Path, Query, State};
use axum::response::Response;
use bytes::Bytes;
use serde_json::json;
use std::collections::HashMap;
use uuid::Uuid;

use crate::extractors::AuthenticatedUser;
use crate::models::file::{BatchDeleteRequest, BatchMoveRequest, FileListQuery};
use crate::models::upload_session::{CompleteChunkedUploadRequest, InitChunkedUploadRequest};
use crate::services::file::FileService;
use crate::utils::{
    file_response, json_response, parse_part_number, parse_uuid_list, success_response, AppError,
};
use crate::AppState;

/// 上传文件（普通上传）
///
/// 处理 multipart/form-data 格式的文件上传请求。
///
/// # 请求格式
/// - Content-Type: `multipart/form-data`
/// - Field name: `file`
///
/// # 响应
/// ```json
/// {
///   "file": {
///     "id": "...",
///     "filename": "...",
///     ...
///   }
/// }
/// ```
pub async fn upload_file_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
    mut multipart: Multipart,
) -> Result<Response, AppError> {
    let file_service = FileService::from_state(&state);

    // 解析 multipart 表单，提取文件数据
    let mut file_data: Option<(String, String, Vec<u8>)> = None;

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| AppError::File(format!("Failed to parse multipart: {}", e)))?
    {
        let name = field.name().unwrap_or("").to_string();

        if name == "file" {
            let filename = field
                .file_name()
                .ok_or_else(|| AppError::File("Missing filename".to_string()))?
                .to_string();

            let mime_type = field
                .content_type()
                .map(|s| s.to_string())
                .unwrap_or_else(|| "application/octet-stream".to_string());

            let data = field
                .bytes()
                .await
                .map_err(|e| AppError::File(format!("Failed to read file: {}", e)))?;

            file_data = Some((filename, mime_type, data.to_vec()));
            break;
        }
    }

    let (original_filename, mime_type, data) =
        file_data.ok_or_else(|| AppError::File("No file provided".to_string()))?;

    let file_size = data.len() as u64;

    // 创建文件（业务逻辑在 FileService 中）
    let file = file_service
        .create_file(user_id, original_filename, mime_type, file_size, data)
        .await?;

    Ok(json_response(json!({ "file": file })))
}

/// 获取文件列表
///
/// 支持分页、搜索、过滤等功能。
///
/// # 查询参数
/// - `page`: 页码（默认: 1）
/// - `limit`: 每页数量（默认: 20，最大: 100）
/// - `search`: 搜索关键词（文件名）
/// - `mime_type`: MIME 类型过滤
/// - `category`: 分类过滤
/// - `date_from`, `date_to`: 日期范围
/// - `size_min`, `size_max`: 文件大小范围
///
/// # 响应
/// ```json
/// {
///   "files": [...],
///   "total": 100,
///   "page": 1,
///   "limit": 20
/// }
/// ```
///
/// 与 skill 规范及前端 `FileListResponse` 一致，使用 `files` 字段。
pub async fn list_files_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
    Query(query): Query<FileListQuery>,
) -> Result<Response, AppError> {
    let file_service = FileService::from_state(&state);

    // 提取分页参数（在移动 query 之前）
    let page = query.page.unwrap_or(1);
    let limit = query.limit.unwrap_or(20);

    let (files, total) = file_service.list_files(user_id, query).await?;

    Ok(json_response(json!({
        "files": files,
        "total": total,
        "page": page,
        "limit": limit,
    })))
}

/// 下载文件
///
/// 返回文件内容，设置 `Content-Disposition: attachment` 触发下载。
pub async fn download_file_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
    Path(file_id): Path<Uuid>,
) -> Result<Response, AppError> {
    let file_service = FileService::from_state(&state);

    // 验证文件所有权并获取文件
    let file = file_service.get_file(file_id, user_id).await?;
    let data = file_service.get_file_data(&file).await?;

    // 构建文件下载响应（attachment 触发下载）
    file_response(data, &file.original_filename, &file.mime_type, false)
        .map_err(|_| AppError::Internal)
}

/// 预览文件
///
/// 返回文件内容，设置 `Content-Disposition: inline` 在浏览器中显示。
pub async fn preview_file_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
    Path(file_id): Path<Uuid>,
) -> Result<Response, AppError> {
    let file_service = FileService::from_state(&state);

    // 验证文件所有权并获取文件
    let file = file_service.get_file(file_id, user_id).await?;
    let data = file_service.get_file_data(&file).await?;

    // 构建文件预览响应（inline 在浏览器中显示）
    file_response(data, &file.original_filename, &file.mime_type, true)
        .map_err(|_| AppError::Internal)
}

/// 删除文件
pub async fn delete_file_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
    Path(file_id): Path<Uuid>,
) -> Result<Response, AppError> {
    let file_service = FileService::from_state(&state);
    file_service.delete_file(file_id, user_id).await?;
    Ok(success_response("File deleted successfully"))
}

/// 批量删除文件
///
/// # 请求体
/// ```json
/// {
///   "ids": ["uuid1", "uuid2", ...]
/// }
/// ```
pub async fn batch_delete_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
    axum::Json(req): axum::Json<BatchDeleteRequest>,
) -> Result<Response, AppError> {
    let file_service = FileService::from_state(&state);
    let deleted = file_service.batch_delete(&req.ids, user_id).await?;
    Ok(json_response(json!({
        "deleted": deleted,
        "message": "Batch delete completed"
    })))
}

/// 批量下载文件（ZIP 格式）
///
/// # 查询参数
/// - `ids`: 逗号分隔的文件 ID 列表
pub async fn batch_download_zip_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Response, AppError> {
    let file_service = FileService::from_state(&state);

    // 解析文件 ID 列表
    let ids_str = params
        .get("ids")
        .ok_or_else(|| AppError::Validation("Missing ids parameter".to_string()))?;
    let ids = parse_uuid_list(ids_str)?;

    // 生成 ZIP 文件
    let zip_data = file_service.batch_download_zip(&ids, user_id).await?;

    // 返回 ZIP 文件响应
    file_response(zip_data, "files.zip", "application/zip", false)
        .map_err(|_| AppError::Internal)
}

/// 获取存储使用情况
///
/// 返回用户的存储使用量和配额信息。
pub async fn storage_usage_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
) -> Result<Response, AppError> {
    let file_service = FileService::from_state(&state);

    let (total_size, file_count) = file_service.get_storage_usage(user_id).await?;
    let quota = file_service.get_storage_quota(user_id).await?;

    // 计算配额信息（MB）
    let quota_mb = quota.map(|q| (q as f64 / 1_048_576.0).round() as i64);
    let usage_percent = quota.map(|q| {
        if q > 0 {
            ((total_size as f64 / q as f64) * 100.0).round() as i32
        } else {
            0
        }
    });

    Ok(json_response(json!({
        "total_size": total_size,
        "file_count": file_count,
        "total_size_mb": (total_size as f64 / 1_048_576.0).round() as i64,
        "quota": quota,
        "quota_mb": quota_mb,
        "usage_percent": usage_percent,
        "is_unlimited": quota.is_none(),
    })))
}

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

/// 批量移动文件到分类
///
/// # 请求体
/// ```json
/// {
///   "ids": ["uuid1", "uuid2", ...],
///   "category": "新分类"  // 空字符串或 null 表示取消分类
/// }
/// ```
pub async fn batch_move_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
    axum::Json(req): axum::Json<BatchMoveRequest>,
) -> Result<Response, AppError> {
    let file_service = FileService::from_state(&state);
    let moved = file_service.batch_move(user_id, req).await?;
    Ok(json_response(json!({
        "moved": moved,
        "message": "Batch move completed"
    })))
}

// ============================================================================
// 分块上传（可恢复上传）Handlers
// ============================================================================

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
        .upload_chunk(upload_id, user_id, part, body.to_vec())
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
