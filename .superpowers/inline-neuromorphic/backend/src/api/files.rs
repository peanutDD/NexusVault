//! # Files API Routes
//!
//! 定义文件管理相关的 API 路由。

use axum::{
    error_handling::HandleErrorLayer,
    http::StatusCode,
    routing::{delete, get, post, put},
    Json, Router,
};
use serde_json::json;
use tower::{limit::ConcurrencyLimitLayer, load_shed::LoadShedLayer, BoxError, ServiceBuilder};

#[path = "files/media_routes.rs"]
mod media_routes;
#[path = "files/search_routes.rs"]
mod search_routes;
#[path = "files/trash_routes.rs"]
mod trash_routes;
#[path = "files/upload_routes.rs"]
mod upload_routes;
#[path = "files/version_tag_routes.rs"]
mod version_tag_routes;

use crate::constants::LIST_CONCURRENCY;
use crate::handlers::files::{
    batch_delete_handler, batch_download_zip_handler, batch_download_zip_post_handler,
    batch_get_handler, batch_move_handler, batch_tags_handler, categories_handler,
    collection_counts_handler, delete_file_handler, list_file_activity_handler, list_files_handler,
    rename_file_handler, storage_usage_handler,
};
use crate::AppState;

async fn overload_response(err: BoxError) -> (StatusCode, Json<serde_json::Value>) {
    tracing::warn!("concurrency limit triggered: {}", err);
    (
        StatusCode::SERVICE_UNAVAILABLE,
        Json(json!({
            "error": "service overloaded",
            "message": "服务器繁忙，请稍后重试",
            "code": "SERVICE_OVERLOADED"
        })),
    )
}

/// 创建文件管理相关的路由
///
/// # 路由列表
///
/// ## 文件操作
/// - `GET /`: 获取文件列表（支持分页、搜索、过滤）
/// - `POST /upload`: 上传文件（普通上传）
/// - `GET /{id}/download`: 下载文件
/// - `GET /{id}/preview`: 预览文件（浏览器内显示）
/// - `DELETE /{id}`: 删除文件
///
/// ## 批量操作
/// - `POST /batch-delete`: 批量删除文件
/// - `POST /batch-move`: 批量移动文件到分类
/// - `GET /download-zip`: 批量下载文件（ZIP 格式）
///
/// ## 分块上传（可恢复上传）
/// - `POST /upload/chunked/init`: 初始化分块上传
/// - `PUT /upload/chunked/{id}/chunk`: 上传分块
/// - `GET /upload/chunked/{id}/status`: 查询上传状态
/// - `POST /upload/chunked/{id}/complete`: 完成上传
/// - `DELETE /upload/chunked/{id}/abort`: 取消上传
///
/// ## 秒传（文件指纹）
/// - `POST /upload/instant`: 按 content_sha256 + file_size 秒传，已有则复用存储
///
/// ## 搜索
/// - `GET /search/semantic`: 语义搜索（基于向量相似度）
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
                    .layer(HandleErrorLayer::new(overload_response))
                    .layer(LoadShedLayer::new())
                    .layer(ConcurrencyLimitLayer::new(LIST_CONCURRENCY)),
            ),
        )
        .merge(upload_routes::router())
        .route("/storage-usage", get(storage_usage_handler))
        .route("/categories", get(categories_handler))
        .route("/collection-counts", get(collection_counts_handler))
        .merge(search_routes::router())
        .merge(trash_routes::router())
        .route("/batch", post(batch_get_handler))
        .route("/batch-delete", post(batch_delete_handler))
        .route("/batch-move", post(batch_move_handler))
        .route("/batch-tags", post(batch_tags_handler))
        .route(
            "/download-zip",
            get(batch_download_zip_handler).post(batch_download_zip_post_handler),
        )
        .merge(media_routes::router())
        .merge(version_tag_routes::router())
        .route("/{id}/activity", get(list_file_activity_handler))
        .route("/{id}", put(rename_file_handler))
        .route("/{id}", delete(delete_file_handler))
}
