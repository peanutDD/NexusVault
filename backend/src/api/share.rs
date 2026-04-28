//! # Share API Routes
//!
//! 定义文件分享相关的 API 路由。

use axum::routing::{delete, get, post};
use axum::Router;

use crate::handlers::share::{
    access_share_handler, batch_create_share_handler, create_share_handler, delete_share_handler,
    download_shared_file_handler,
};
use crate::AppState;

/// 创建分享相关的路由
///
/// # 路由列表
/// - `POST /`: 创建分享链接（需认证）
/// - `POST /batch`: 批量创建分享（需认证）
/// - `POST /{token}/access`: 访问分享文件（验证密码）
/// - `GET /{token}/download`: 下载分享文件
/// - `DELETE /{id}`: 删除分享链接（需认证）
pub fn create_router() -> Router<AppState> {
    Router::new()
        .route("/", post(create_share_handler))
        .route("/batch", post(batch_create_share_handler))
        .route("/{token}/access", post(access_share_handler))
        .route("/{token}/download", get(download_shared_file_handler))
        .route("/{id}", delete(delete_share_handler))
}
