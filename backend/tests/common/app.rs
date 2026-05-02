//! # 集成测试应用基础设施
//!
//! 提供测试用的应用构建和认证辅助函数。
//!
//! 遵循约束 C-004：集成测试统一通过 `tests/common::build_test_app(pool)` 起完整 `axum::Router` + 真 PG

use std::sync::Arc;

use axum::{
    http::{HeaderName, HeaderValue},
    Router,
};
use sqlx::PgPool;
use uuid::Uuid;

use file_storage_backend::{
    app::create_app,
    config::Config,
    services::auth::AuthService,
    AppState as RootAppState,
};

/// 创建测试用的 Axum Router
///
/// # 参数
/// - `pool`: PostgreSQL 数据库连接池
///
/// # 返回
/// 配置完成的 Axum Router，包含所有 API 路由和中间件
pub async fn build_test_app(pool: &PgPool) -> Router {
    // 创建测试配置
    let config = Arc::new(Config::from_env().unwrap_or_else(|_| {
        Config::default_for_test()
    }));

    // 创建存储后端（使用内存存储进行测试）
    let storage = file_storage_backend::services::storage::create_memory_backend();

    // 创建应用状态
    let app_state = RootAppState::new(
        config.clone(),
        pool.clone(),
        pool.clone(),
        Arc::new(storage),
        None, // 不使用 Redis
    );

    // 创建应用（使用空的 metrics 渲染器）
    create_app(app_state, config.as_ref(), || "".to_string()).await
}

/// 生成认证请求头
///
/// # 参数
/// - `auth_service`: 认证服务实例
/// - `user_id`: 用户 ID
///
/// # 返回
/// (HeaderName, HeaderValue) 元组，可直接用于请求头
pub async fn auth_header(
    auth_service: &AuthService,
    user_id: &Uuid,
) -> (HeaderName, HeaderValue) {
    let token = auth_service.generate_token(user_id).unwrap();
    let header_name = HeaderName::from_static("authorization");
    let header_value = HeaderValue::from_str(&format!("Bearer {}", token)).unwrap();
    (header_name, header_value)
}

/// 创建测试用户并获取 JWT token
///
/// # 参数
/// - `pool`: PostgreSQL 数据库连接池
/// - `suffix`: 用户名后缀，用于区分不同测试用户
///
/// # 返回
/// (user_id, token) 元组
pub async fn login_and_get_token(pool: &PgPool, suffix: &str) -> (Uuid, String) {
    // 创建测试用户
    let (user_id, email, password) = super::create_test_user(pool, suffix).await;

    // 创建认证服务
    let config = Config::from_env().unwrap_or_else(|_| Config::default_for_test());
    let auth_service = AuthService::new(
        std::sync::Arc::new(file_storage_backend::repositories::SqlxUsersRepo::new(pool.clone())),
        config,
        file_storage_backend::services::cache::CacheService::new(),
        None,
    );

    // 登录获取 token
    let token = auth_service
        .login(file_storage_backend::models::user::LoginRequest { email, password })
        .await
        .unwrap();

    (user_id, token)
}

/// 生成 Bearer token 请求头
///
/// # 参数
/// - `token`: JWT token
///
/// # 返回
/// (HeaderName, HeaderValue) 元组
pub fn bearer_auth_header(token: &str) -> (HeaderName, HeaderValue) {
    let header_name = HeaderName::from_static("authorization");
    let header_value = HeaderValue::from_str(&format!("Bearer {}", token)).unwrap();
    (header_name, header_value)
}