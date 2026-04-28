//! # API Token Routes
//!
//! 定义 API Token 管理相关的路由。

use axum::{
    routing::{delete, get},
    Router,
};

use crate::handlers::api_token::{create_token_handler, delete_token_handler, list_tokens_handler};
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
        .route("/{id}", delete(delete_token_handler))
}
