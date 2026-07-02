//! # Auth API Routes
//!
//! 定义用户认证相关的 API 路由。

use axum::routing::{get, post, put};
use axum::Router;

use crate::api::oauth_github::{github_oauth_callback_handler, github_oauth_url_handler};
use crate::api::oauth_google::{google_oauth_callback_handler, google_oauth_url_handler};
use crate::handlers::auth::{
    change_password_handler, check_profile_availability_handler, login_handler, me_handler,
    register_handler, send_email_verification_handler, update_profile_handler,
};
use crate::AppState;

/// 创建认证相关的路由
///
/// # 路由列表
/// - `POST /register`: 用户注册
/// - `POST /login`: 用户登录
/// - `GET /me`: 获取当前用户信息（需认证）
/// - `PUT /change-password`: 修改密码（需认证）
/// - `PUT /update-profile`: 更新用户资料（需认证）
/// - `POST /send-email-verification`: 发送邮箱验证码（需认证）
/// - `GET /check-profile-availability`: 检查用户名和邮箱是否可用（需认证）
pub fn create_router() -> Router<AppState> {
    Router::new()
        .route("/register", post(register_handler))
        .route("/login", post(login_handler))
        .route("/me", get(me_handler))
        .route("/change-password", put(change_password_handler))
        .route("/update-profile", put(update_profile_handler))
        .route(
            "/send-email-verification",
            post(send_email_verification_handler),
        )
        .route(
            "/check-profile-availability",
            get(check_profile_availability_handler),
        )
        // 第三方登录：GitHub OAuth
        .route("/oauth/github/url", get(github_oauth_url_handler))
        .route("/oauth/github/callback", get(github_oauth_callback_handler))
        // 第三方登录：Google OAuth
        .route("/oauth/google/url", get(google_oauth_url_handler))
        .route("/oauth/google/callback", get(google_oauth_callback_handler))
}
