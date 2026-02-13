//! # Folders API Routes
//!
//! 定义文件夹管理相关的 API 路由。

use axum::{
    routing::{delete, get, post, put},
    Router,
};

use crate::handlers::folders::{
    create_folder_handler, delete_folder_handler, get_files_in_folders_handler,
    get_folder_contents_handler, get_folder_handler, get_folder_path_handler, list_folders_handler,
    move_files_to_folder_handler, move_folder_handler, rename_folder_handler,
};
use crate::AppState;

/// 创建文件夹管理相关的路由
///
/// # 路由列表
///
/// ## 文件夹操作
/// - `POST /`: 创建文件夹
/// - `GET /`: 列出文件夹（可选 parent_id 参数）
/// - `GET /contents`: 获取文件夹内容（子文件夹 + 路径）
/// - `GET /:id`: 获取文件夹详情
/// - `GET /:id/path`: 获取文件夹路径（面包屑）
/// - `PUT /:id`: 重命名文件夹
/// - `DELETE /:id`: 删除文件夹
/// - `POST /:id/move`: 移动文件夹
///
/// ## 文件移动
/// - `POST /move-files`: 批量移动文件到文件夹
/// - `POST /files-in-folders`: 获取文件夹内所有文件 ID（递归）
pub fn create_router() -> Router<AppState> {
    Router::new()
        .route("/", post(create_folder_handler))
        .route("/", get(list_folders_handler))
        .route("/contents", get(get_folder_contents_handler))
        .route("/move-files", post(move_files_to_folder_handler))
        .route("/files-in-folders", post(get_files_in_folders_handler))
        .route("/:id", get(get_folder_handler))
        .route("/:id/path", get(get_folder_path_handler))
        .route("/:id", put(rename_folder_handler))
        .route("/:id", delete(delete_folder_handler))
        .route("/:id/move", post(move_folder_handler))
}
