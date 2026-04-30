//! # Folder Handlers
//!
//! 处理文件夹相关的 HTTP 请求，包括：
//! - 文件夹创建、重命名、删除
//! - 文件夹列表和路径导航
//! - 文件夹移动
//! - 文件移动到文件夹
//!
//! ## 设计原则
//!
//! 1. **职责单一**: 每个 handler 只负责 HTTP 请求处理和响应构建
//! 2. **业务逻辑分离**: 所有业务逻辑都在 `FolderService` 中
//! 3. **统一认证**: 使用 `AuthenticatedUser` extractor 自动处理认证
//! 4. **统一响应**: 使用 `utils::response` 中的辅助函数构建响应

use axum::extract::{Path, Query, State};
use axum::response::Response;
use axum::Json;
use serde_json::json;
use uuid::Uuid;

use crate::extractors::AuthenticatedUser;
use crate::models::folder::{
    BatchMoveToFolderRequest, CreateFolderRequest, FolderListQuery, GetFilesInFoldersRequest,
    MoveFolderRequest, RenameFolderRequest,
};
use crate::services::folder::FolderService;
use crate::services::cache::files::{CACHE_PREFIX_FOLDERS_CONTENTS, CACHE_PREFIX_FOLDERS_LIST};
use crate::utils::{cache, json_response, AppError};
use crate::AppState;

/// 创建文件夹
///
/// # 请求体
/// ```json
/// {
///   "name": "新文件夹",
///   "parent_id": "uuid" // 可选，不传表示根目录
/// }
/// ```
///
/// # 响应
/// ```json
/// {
///   "folder": {
///     "id": "...",
///     "name": "新文件夹",
///     "parent_id": null,
///     ...
///   }
/// }
/// ```
pub async fn create_folder_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
    Json(req): Json<CreateFolderRequest>,
) -> Result<Response, AppError> {
    let folder_service = FolderService::from_state(&state);
    let folder = folder_service.create_folder(user_id, req).await?;
    if let Some(pool) = &state.redis {
        let _ = crate::services::redis::RedisService::new(pool.clone())
            .bump_user_cache_version(user_id)
            .await;
    }
    Ok(json_response(json!({ "folder": folder })))
}

/// 列出文件夹
///
/// # 查询参数
/// - `parent_id`: 父文件夹 ID（可选，不传表示根目录）
///
/// # 响应
/// ```json
/// {
///   "folders": [...]
/// }
/// ```
pub async fn list_folders_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
    Query(query): Query<FolderListQuery>,
) -> Result<Response, AppError> {
    let parent_key = query.parent_id.map(|p| p.to_string()).unwrap_or_default();

    // 尝试从缓存获取
    if let Some(pool) = &state.redis {
        if let Some(cached) = cache::get_cached_response(pool, user_id, CACHE_PREFIX_FOLDERS_LIST, &parent_key).await {
            return Ok(cached);
        }
    }

    // 缓存未命中，从数据库获取
    let folder_service = FolderService::from_state(&state);
    let folders = folder_service
        .list_folders(user_id, query.parent_id)
        .await?;
    let body = json!({ "folders": folders });

    // 回填缓存
    if let Some(pool) = &state.redis {
        cache::set_cached_response(pool, user_id, CACHE_PREFIX_FOLDERS_LIST, &parent_key, &body, 60).await;
    }

    Ok(json_response(body))
}

/// 获取文件夹内容（子文件夹 + 路径）
///
/// # 查询参数
/// - `parent_id`: 文件夹 ID（可选，不传表示根目录）
///
/// # 响应
/// ```json
/// {
///   "current": {...} | null,
///   "path": [...],
///   "folders": [...]
/// }
/// ```
pub async fn get_folder_contents_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
    Query(query): Query<FolderListQuery>,
) -> Result<Response, AppError> {
    let parent_key = query.parent_id.map(|p| p.to_string()).unwrap_or_default();

    // 尝试从缓存获取
    if let Some(pool) = &state.redis {
        if let Some(cached) = cache::get_cached_response(pool, user_id, CACHE_PREFIX_FOLDERS_CONTENTS, &parent_key).await {
            return Ok(cached);
        }
    }

    // 缓存未命中，从数据库获取
    let folder_service = FolderService::from_state(&state);
    let contents = folder_service
        .get_folder_contents(user_id, query.parent_id)
        .await?;
    let body = json!(contents);

    // 回填缓存
    if let Some(pool) = &state.redis {
        cache::set_cached_response(pool, user_id, CACHE_PREFIX_FOLDERS_CONTENTS, &parent_key, &body, 60).await;
    }

    Ok(json_response(body))
}

/// 获取文件夹详情
///
/// # 路径参数
/// - `id`: 文件夹 ID
///
/// # 响应
/// ```json
/// {
///   "folder": {...}
/// }
/// ```
pub async fn get_folder_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
    Path(id): Path<Uuid>,
) -> Result<Response, AppError> {
    let folder_service = FolderService::from_state(&state);
    let folder = folder_service.get_folder(user_id, id).await?;
    Ok(json_response(json!({ "folder": folder })))
}

/// 获取文件夹路径（面包屑导航）
///
/// # 路径参数
/// - `id`: 文件夹 ID
///
/// # 响应
/// ```json
/// {
///   "path": [
///     { "id": "...", "name": "根文件夹" },
///     { "id": "...", "name": "子文件夹" },
///     ...
///   ]
/// }
/// ```
pub async fn get_folder_path_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
    Path(id): Path<Uuid>,
) -> Result<Response, AppError> {
    let folder_service = FolderService::from_state(&state);
    let path = folder_service.get_folder_path(user_id, id).await?;
    Ok(json_response(json!(path)))
}

/// 重命名文件夹
///
/// # 路径参数
/// - `id`: 文件夹 ID
///
/// # 请求体
/// ```json
/// {
///   "name": "新名称"
/// }
/// ```
///
/// # 响应
/// ```json
/// {
///   "folder": {...}
/// }
/// ```
pub async fn rename_folder_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
    Path(id): Path<Uuid>,
    Json(req): Json<RenameFolderRequest>,
) -> Result<Response, AppError> {
    let folder_service = FolderService::from_state(&state);
    let folder = folder_service.rename_folder(user_id, id, req).await?;
    if let Some(pool) = &state.redis {
        let _ = crate::services::redis::RedisService::new(pool.clone())
            .bump_user_cache_version(user_id)
            .await;
    }
    Ok(json_response(json!({ "folder": folder })))
}

/// 删除文件夹
///
/// 级联删除所有子文件夹，文件的 folder_id 会被设为 NULL。
///
/// # 路径参数
/// - `id`: 文件夹 ID
///
/// # 响应
/// ```json
/// {
///   "message": "文件夹删除成功",
///   "affected_files": 5
/// }
/// ```
pub async fn delete_folder_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
    Path(id): Path<Uuid>,
) -> Result<Response, AppError> {
    let folder_service = FolderService::from_state(&state);
    let affected = folder_service.delete_folder(user_id, id).await?;
    if let Some(pool) = &state.redis {
        let _ = crate::services::redis::RedisService::new(pool.clone())
            .bump_user_cache_version(user_id)
            .await;
    }
    Ok(json_response(json!({
        "message": "文件夹删除成功",
        "affected_files": affected
    })))
}

/// 移动文件夹
///
/// # 路径参数
/// - `id`: 要移动的文件夹 ID
///
/// # 请求体
/// ```json
/// {
///   "parent_id": "uuid" | null // null 表示移动到根目录
/// }
/// ```
///
/// # 响应
/// ```json
/// {
///   "folder": {...}
/// }
/// ```
pub async fn move_folder_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
    Path(id): Path<Uuid>,
    Json(req): Json<MoveFolderRequest>,
) -> Result<Response, AppError> {
    let folder_service = FolderService::from_state(&state);
    let folder = folder_service.move_folder(user_id, id, req).await?;
    if let Some(pool) = &state.redis {
        let _ = crate::services::redis::RedisService::new(pool.clone())
            .bump_user_cache_version(user_id)
            .await;
    }
    Ok(json_response(json!({ "folder": folder })))
}

/// 批量移动文件到文件夹
///
/// # 请求体
/// ```json
/// {
///   "file_ids": ["uuid1", "uuid2", ...],
///   "folder_id": "uuid" | null // null 表示移动到根目录
/// }
/// ```
///
/// # 响应
/// ```json
/// {
///   "message": "文件移动成功",
///   "moved": 5
/// }
/// ```
pub async fn move_files_to_folder_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
    Json(req): Json<BatchMoveToFolderRequest>,
) -> Result<Response, AppError> {
    let folder_service = FolderService::from_state(&state);
    let moved = folder_service
        .move_files_to_folder(user_id, req.file_ids, req.folder_id)
        .await?;
    if let Some(pool) = &state.redis {
        let _ = crate::services::redis::RedisService::new(pool.clone())
            .bump_user_cache_version(user_id)
            .await;
    }
    Ok(json_response(json!({
        "message": "文件移动成功",
        "moved": moved
    })))
}

/// 获取文件夹内所有文件 ID（递归）
///
/// # 请求体
/// ```json
/// {
///   "folder_ids": ["uuid1", "uuid2", ...]
/// }
/// ```
///
/// # 响应
/// ```json
/// {
///   "file_ids": ["uuid1", "uuid2", ...]
/// }
/// ```
pub async fn get_files_in_folders_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
    Json(req): Json<GetFilesInFoldersRequest>,
) -> Result<Response, AppError> {
    let folder_service = FolderService::from_state(&state);
    let file_ids = folder_service
        .get_all_file_ids_in_folders(user_id, req.folder_ids)
        .await?;
    Ok(json_response(json!({ "file_ids": file_ids })))
}
