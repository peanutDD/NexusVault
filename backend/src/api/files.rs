//! # Files API Routes
//!
//! 定义文件管理相关的 API 路由。

use axum::{
    error_handling::HandleErrorLayer,
    extract::DefaultBodyLimit,
    http::StatusCode,
    routing::{delete, get, post, put},
    Json,
    Router,
};
use serde_json::json;
use tower::{limit::ConcurrencyLimitLayer, load_shed::LoadShedLayer, BoxError, ServiceBuilder};
use tower_http::limit::RequestBodyLimitLayer;

use crate::handlers::files::{
    batch_delete_handler, batch_download_zip_handler, batch_download_zip_post_handler,
    batch_move_handler, categories_handler,
    chunked_upload_abort_handler, chunked_upload_chunk_handler, chunked_upload_complete_handler,
    chunked_upload_init_handler, chunked_upload_status_handler, delete_file_handler,
    download_file_handler, list_files_handler, preview_file_handler, storage_usage_handler,
    upload_file_handler,
};
use crate::AppState;

/// 单文件上传最大 100MB（小文件直接上传，大文件使用分块上传）
const MAX_UPLOAD_BODY: usize = 104_857_600;
/// 分块上传每块最大 12 MiB（前端使用 10MB 块，留出边界空间）
const MAX_CHUNK_BODY: usize = 12 * 1024 * 1024;

/// 并发限制（单机 10 核 / max_connections=20 的保守起步值）
///
/// 目标：在高并发下快速背压，避免：
/// - 连接池排队导致堆积
/// - 大文件处理导致内存/IO 被打爆
const LIST_CONCURRENCY: usize = 12;
const UPLOAD_CONCURRENCY: usize = 4;
const CHUNK_CONCURRENCY: usize = 12;
const COMPLETE_CONCURRENCY: usize = 2;

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
pub fn create_router() -> Router<AppState> {
    Router::new()
        .route(
            "/",
            get(list_files_handler).layer(
                ServiceBuilder::new()
                    .layer(HandleErrorLayer::new(|err: BoxError| async move {
                        tracing::warn!("concurrency limit triggered: {}", err);
                        (
                            StatusCode::SERVICE_UNAVAILABLE,
                            Json(json!({
                                "error": "service overloaded",
                                "message": "服务器繁忙，请稍后重试",
                                "code": "SERVICE_OVERLOADED"
                            })),
                        )
                    }))
                    .layer(LoadShedLayer::new())
                    .layer(ConcurrencyLimitLayer::new(LIST_CONCURRENCY)),
            ),
        )
        .route(
            "/upload",
            post(upload_file_handler)
                .layer(
                    ServiceBuilder::new()
                        .layer(RequestBodyLimitLayer::new(MAX_UPLOAD_BODY))
                        .layer(HandleErrorLayer::new(|err: BoxError| async move {
                            tracing::warn!("concurrency limit triggered: {}", err);
                            (
                                StatusCode::SERVICE_UNAVAILABLE,
                                Json(json!({
                                    "error": "service overloaded",
                                    "message": "服务器繁忙，请稍后重试",
                                    "code": "SERVICE_OVERLOADED"
                                })),
                            )
                        }))
                        .layer(LoadShedLayer::new())
                        .layer(ConcurrencyLimitLayer::new(UPLOAD_CONCURRENCY)),
                ),
        )
        .route(
            "/upload/chunked/init",
            post(chunked_upload_init_handler).layer(
                ServiceBuilder::new()
                    .layer(HandleErrorLayer::new(|err: BoxError| async move {
                        tracing::warn!("concurrency limit triggered: {}", err);
                        (
                            StatusCode::SERVICE_UNAVAILABLE,
                            Json(json!({
                                "error": "service overloaded",
                                "message": "服务器繁忙，请稍后重试",
                                "code": "SERVICE_OVERLOADED"
                            })),
                        )
                    }))
                    .layer(LoadShedLayer::new())
                    .layer(ConcurrencyLimitLayer::new(UPLOAD_CONCURRENCY)),
            ),
        )
        // Chunk 用 Bytes extractor，须 DefaultBodyLimit 否则默认 2MB 拒收 5MB 块
        .route(
            "/upload/chunked/:id/chunk",
            put(chunked_upload_chunk_handler)
                .layer(
                    ServiceBuilder::new()
                        .layer(DefaultBodyLimit::max(MAX_CHUNK_BODY))
                        .layer(HandleErrorLayer::new(|err: BoxError| async move {
                            tracing::warn!("concurrency limit triggered: {}", err);
                            (
                                StatusCode::SERVICE_UNAVAILABLE,
                                Json(json!({
                                    "error": "service overloaded",
                                    "message": "服务器繁忙，请稍后重试",
                                    "code": "SERVICE_OVERLOADED"
                                })),
                            )
                        }))
                        .layer(LoadShedLayer::new())
                        .layer(ConcurrencyLimitLayer::new(CHUNK_CONCURRENCY)),
                ),
        )
        .route(
            "/upload/chunked/:id/status",
            get(chunked_upload_status_handler),
        )
        .route(
            "/upload/chunked/:id/complete",
            post(chunked_upload_complete_handler).layer(
                ServiceBuilder::new()
                    .layer(HandleErrorLayer::new(|err: BoxError| async move {
                        tracing::warn!("concurrency limit triggered: {}", err);
                        (
                            StatusCode::SERVICE_UNAVAILABLE,
                            Json(json!({
                                "error": "service overloaded",
                                "message": "服务器繁忙，请稍后重试",
                                "code": "SERVICE_OVERLOADED"
                            })),
                        )
                    }))
                    .layer(LoadShedLayer::new())
                    .layer(ConcurrencyLimitLayer::new(COMPLETE_CONCURRENCY)),
            ),
        )
        .route(
            "/upload/chunked/:id/abort",
            delete(chunked_upload_abort_handler),
        )
        .route("/storage-usage", get(storage_usage_handler))
        .route("/categories", get(categories_handler))
        .route("/batch-delete", post(batch_delete_handler))
        .route("/batch-move", post(batch_move_handler))
        .route(
            "/download-zip",
            get(batch_download_zip_handler).post(batch_download_zip_post_handler),
        )
        .route("/:id/download", get(download_file_handler).head(download_file_handler))
        .route("/:id/preview", get(preview_file_handler).head(preview_file_handler))
        .route("/:id", delete(delete_file_handler))
}
