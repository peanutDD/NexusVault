//! # Auth API Routes
//!
//! 定义用户认证相关的 API 路由。

use axum::routing::{get, post, put};
use axum::Router;

use crate::handlers::auth::{change_password_handler, login_handler, me_handler, register_handler};
use crate::AppState;

/// 创建认证相关的路由
///
/// # 路由列表
/// - `POST /register`: 用户注册
/// - `POST /login`: 用户登录
/// - `GET /me`: 获取当前用户信息（需认证）
/// - `PUT /change-password`: 修改密码（需认证）
pub fn create_router() -> Router<AppState> {
    Router::new()
        .route("/register", post(register_handler))
        .route("/login", post(login_handler))
        .route("/me", get(me_handler))
        .route("/change-password", put(change_password_handler))
}
