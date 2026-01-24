//! # Files API Routes
//!
//! 定义文件管理相关的 API 路由。

use axum::{
    routing::{delete, get, post, put},
    Router,
};

use crate::handlers::files::{
    batch_delete_handler, batch_download_zip_handler, batch_move_handler, categories_handler,
    chunked_upload_abort_handler, chunked_upload_chunk_handler, chunked_upload_complete_handler,
    chunked_upload_init_handler, chunked_upload_status_handler, delete_file_handler,
    download_file_handler, list_files_handler, preview_file_handler, storage_usage_handler,
    upload_file_handler,
};

/// 创建文件管理相关的路由
///
/// # 路由列表
///
/// ## 文件操作
/// - `GET /`: 获取文件列表（支持分页、搜索、过滤）
/// - `POST /upload`: 上传文件（普通上传）
/// - `GET /:id/download`: 下载文件
/// - `GET /:id/preview`: 预览文件（浏览器内显示）
/// - `DELETE /:id`: 删除文件
///
/// ## 批量操作
/// - `POST /batch-delete`: 批量删除文件
/// - `POST /batch-move`: 批量移动文件到分类
/// - `GET /download-zip`: 批量下载文件（ZIP 格式）
///
/// ## 分块上传（可恢复上传）
/// - `POST /upload/chunked/init`: 初始化分块上传
/// - `PUT /upload/chunked/:id/chunk`: 上传分块
/// - `GET /upload/chunked/:id/status`: 查询上传状态
/// - `POST /upload/chunked/:id/complete`: 完成上传
/// - `DELETE /upload/chunked/:id/abort`: 取消上传
///
/// ## 其他
/// - `GET /storage-usage`: 获取存储使用情况
/// - `GET /categories`: 获取文件分类列表
pub fn create_router() -> Router {
    Router::new()
        .route("/", get(list_files_handler))
        .route("/upload", post(upload_file_handler))
        .route("/upload/chunked/init", post(chunked_upload_init_handler))
        .route(
            "/upload/chunked/:id/chunk",
            put(chunked_upload_chunk_handler),
        )
        .route(
            "/upload/chunked/:id/status",
            get(chunked_upload_status_handler),
        )
        .route(
            "/upload/chunked/:id/complete",
            post(chunked_upload_complete_handler),
        )
        .route(
            "/upload/chunked/:id/abort",
            delete(chunked_upload_abort_handler),
        )
        .route("/storage-usage", get(storage_usage_handler))
        .route("/categories", get(categories_handler))
        .route("/batch-delete", post(batch_delete_handler))
        .route("/batch-move", post(batch_move_handler))
        .route("/download-zip", get(batch_download_zip_handler))
        .route("/:id/download", get(download_file_handler))
        .route("/:id/preview", get(preview_file_handler))
        .route("/:id", delete(delete_file_handler))
}
