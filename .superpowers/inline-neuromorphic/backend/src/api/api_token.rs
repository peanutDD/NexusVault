//! # API Token Routes
//!
//! 定义 API Token 管理相关的路由。

use axum::{
    routing::{get, patch, post},
    Router,
};

use crate::handlers::api_token::{
    create_token_handler, create_webdav_wizard_token_handler, delete_token_handler,
    list_tokens_handler, list_webdav_activity_handler, list_webdav_diagnostics_handler,
    update_token_handler,
};
use crate::AppState;

/// 创建 API Token 相关的路由
///
/// # 路由列表
/// - `GET /`: 列出用户的所有 API Token（需认证）
/// - `POST /`: 创建新的 API Token（需认证）
/// - `DELETE /{id}`: 删除 API Token（需认证）
pub fn create_router() -> Router<AppState> {
    Router::new()
        .route("/", get(list_tokens_handler).post(create_token_handler))
        .route("/webdav-wizard", post(create_webdav_wizard_token_handler))
        .route("/webdav-activity", get(list_webdav_activity_handler))
        .route("/webdav-diagnostics", get(list_webdav_diagnostics_handler))
        .route(
            "/{id}",
            patch(update_token_handler).delete(delete_token_handler),
        )
}
