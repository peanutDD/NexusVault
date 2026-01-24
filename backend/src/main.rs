//! # File Storage Backend
//!
//! 基于 Axum、SQLx 和 Tokio 的文件存储后端服务。
//!
//! ## 架构
//!
//! - `api/`: 路由定义
//! - `handlers/`: HTTP 请求处理
//! - `services/`: 业务逻辑层
//! - `models/`: 数据模型
//! - `middleware/`: 中间件
//! - `extractors/`: Axum extractors（认证等）
//! - `database/`: 数据库连接池
//! - `utils/`: 工具函数
//! - `config.rs`: 配置管理

mod api;
mod config;
mod database;
mod extractors;
mod handlers;
mod middleware;
mod models;
mod services;
mod utils;

use axum::{
    extract::{Extension, Request},
    middleware::Next,
    response::Response,
    routing::get,
    Router,
};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tower::ServiceBuilder;
use tower_http::{cors::CorsLayer, timeout::TimeoutLayer, trace::TraceLayer};
// use tower_governor::{governor::GovernorConfigBuilder, GovernorLayer};
// use std::net::IpAddr;

use config::Config;
use database::pool::create_pool;
use middleware::rate_limit;
use services::file::create_storage;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "file_storage_backend=debug,axum=info".into()),
        )
        .init();

    // Load configuration
    dotenv::dotenv().ok();
    let config = Arc::new(Config::from_env()?);

    // Create database pool
    let pool = create_pool(&config.database_url).await?;

    // Run migrations
    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .expect("Failed to run migrations");

    // Create storage once at startup (shared across requests)
    let storage = create_storage(config.clone())
        .await
        .expect("Failed to create storage backend");

    // Build application
    let app = create_app(config.clone(), pool, storage).await;

    let addr = format!("0.0.0.0:{}", config.port);
    tracing::info!("Server listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

/// 创建并配置 Axum 应用
///
/// # 参数
/// - `config`: 应用配置
/// - `pool`: 数据库连接池
/// - `storage`: 存储后端
///
/// # 返回
/// 配置完成的 Axum Router
async fn create_app(
    config: Arc<Config>,
    pool: sqlx::PgPool,
    storage: std::sync::Arc<dyn services::storage::StorageBackend>,
) -> Router {
    // 配置 CORS
    let cors = create_cors_layer(&config);

    // 配置速率限制：每分钟 100 个请求
    let rate_limit_state = rate_limit::create_rate_limit_middleware(100, 60);

    // 构建中间件栈
    let middleware_stack = ServiceBuilder::new()
        .layer(TraceLayer::new_for_http()) // HTTP 请求追踪
        .layer(TimeoutLayer::new(Duration::from_secs(30))) // 30 秒超时
        .layer(cors) // CORS 支持
        .into_inner();

    // 构建路由
    Router::new()
        // 健康检查端点
        .route("/health", get(health_check))
        // API 路由
        .nest("/api/auth", api::auth::create_router())
        .nest("/api/files", api::files::create_router())
        .nest("/api/shares", api::share::create_router())
        .nest("/api/tokens", api::api_token::create_router())
        // 应用中间件（从外到内执行）
        .layer(axum::middleware::from_fn(move |req, next| {
            let state = rate_limit_state.clone();
            rate_limit::rate_limit_middleware(state, req, next)
        }))
        .layer(axum::middleware::from_fn(request_logger))
        .layer(middleware_stack)
        // 注入共享状态（可在 handlers 和 extractors 中使用）
        .layer(Extension(config))
        .layer(Extension(pool))
        .layer(Extension(storage))
}

/// 创建 CORS 中间件层
///
/// 根据配置创建适当的 CORS 策略。
fn create_cors_layer(config: &Config) -> CorsLayer {
    let cors_origin = if config.cors_origin == "*" {
        tower_http::cors::Any.into()
    } else {
        config
            .cors_origin
            .parse::<axum::http::HeaderValue>()
            .map(tower_http::cors::AllowOrigin::exact)
            .unwrap_or(tower_http::cors::Any.into())
    };

    CorsLayer::new()
        .allow_origin(cors_origin)
        .allow_methods([
            axum::http::Method::GET,
            axum::http::Method::POST,
            axum::http::Method::DELETE,
            axum::http::Method::PUT,
            axum::http::Method::OPTIONS,
        ])
        .allow_headers([
            axum::http::header::CONTENT_TYPE,
            axum::http::header::AUTHORIZATION,
        ])
        .allow_credentials(config.cors_origin != "*")
}

/// 健康检查端点
///
/// 用于监控和负载均衡器健康检查。
async fn health_check() -> &'static str {
    "OK"
}

/// 请求日志中间件
///
/// 记录每个 HTTP 请求的详细信息，包括：
/// - HTTP 方法
/// - 请求路径
/// - 响应状态码
/// - 处理耗时（毫秒）
async fn request_logger(req: Request, next: Next) -> Response {
    let method = req.method().clone();
    let path = req.uri().path().to_string();
    let start = Instant::now();
    let res = next.run(req).await;
    let status = res.status();
    tracing::info!(
        method = %method,
        path = %path,
        status = %status,
        elapsed_ms = start.elapsed().as_millis(),
        "request"
    );
    res
}
