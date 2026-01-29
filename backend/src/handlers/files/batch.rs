//! 批量操作
//!
//! - 批量删除
//! - 批量按 ID 查详情
//! - 批量移动到分类
//! - 批量打包下载（ZIP）

use axum::extract::{Query, State};
use axum::response::Response;
use serde_json::json;
use std::collections::HashMap;

use crate::extractors::AuthenticatedUser;
use crate::models::file::{BatchDeleteRequest, BatchGetRequest, BatchMoveRequest};
use crate::services::file::FileService;
use crate::utils::{file_response, json_response, parse_uuid_list, AppError};
use crate::AppState;

/// 批量按 ID 查询文件元数据
///
/// 返回顺序与请求 ids 一致；未找到或无权访问的项为 null。
/// 供前端批量请求合并（BatchRequestManager）使用。
///
/// # 请求体
/// ```json
/// { "ids": ["uuid1", "uuid2", ...] }
/// ```
pub async fn batch_get_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
    axum::Json(req): axum::Json<BatchGetRequest>,
) -> Result<Response, AppError> {
    let file_service = FileService::from_state(&state);
    let files = file_service.get_files_by_ids(user_id, &req.ids).await?;
    Ok(json_response(json!({ "files": files })))
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
    file_response(zip_data, "files.zip", "application/zip", false).map_err(|_| AppError::Internal)
}

/// 批量下载文件（ZIP 格式）- POST 版本
///
/// 避免 GET 查询参数过长（文件过多时 URL 可能超限）。
///
/// # 请求体
/// ```json
/// { "ids": ["uuid1", "uuid2", "..."] }
/// ```
pub async fn batch_download_zip_post_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
    axum::Json(req): axum::Json<BatchDeleteRequest>,
) -> Result<Response, AppError> {
    let file_service = FileService::from_state(&state);

    // 生成 ZIP 文件
    let zip_data = file_service.batch_download_zip(&req.ids, user_id).await?;

    // 返回 ZIP 文件响应
    file_response(zip_data, "files.zip", "application/zip", false).map_err(|_| AppError::Internal)
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
