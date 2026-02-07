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
mod constants;
mod database;
mod extractors;
mod handlers;
mod middleware;
mod models;
mod repositories;
mod services;
mod state;
mod utils;

pub use state::AppState;

use axum::{
    error_handling::HandleErrorLayer, extract::Request, http::StatusCode, middleware::Next,
    response::Response, routing::get, Json, Router,
};
use serde_json::json;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tower::{limit::ConcurrencyLimitLayer, load_shed::LoadShedLayer, BoxError, ServiceBuilder};
use tower_http::{
    catch_panic::CatchPanicLayer,
    cors::{Any, AllowOrigin, CorsLayer},
    timeout::TimeoutLayer,
    trace::TraceLayer,
};
// use tower_governor::{governor::GovernorConfigBuilder, GovernorLayer};
// use std::net::IpAddr;

use api::openapi::create_openapi_router;
use config::Config;
use database::pool::create_pool;
use middleware::metrics::metrics_middleware;
use middleware::rate_limit;
use services::file::create_storage;
use services::maintenance::{
    spawn_files_consistency_checker, spawn_orphan_storage_files_cleanup,
    spawn_upload_session_cleanup,
};

fn main() -> anyhow::Result<()> {
    // 允许通过环境变量调优 Tokio runtime（学习/压测非常有用）
    // - TOKIO_WORKER_THREADS：CPU 密集型任务并发（默认=可用 CPU 核心数）
    // - TOKIO_MAX_BLOCKING_THREADS：阻塞任务池上限（默认=512，影响 tokio::fs/CPU-heavy blocking）
    let worker_threads = std::env::var("TOKIO_WORKER_THREADS")
        .ok()
        .and_then(|v| v.parse::<usize>().ok())
        .unwrap_or_else(|| {
            std::thread::available_parallelism()
                .map(|n| n.get())
                .unwrap_or(10)
        });

    let max_blocking_threads = std::env::var("TOKIO_MAX_BLOCKING_THREADS")
        .ok()
        .and_then(|v| v.parse::<usize>().ok())
        .unwrap_or(512);

    tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .worker_threads(worker_threads)
        .max_blocking_threads(max_blocking_threads)
        .build()?
        .block_on(async_main())
}

async fn async_main() -> anyhow::Result<()> {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "file_storage_backend=debug,axum=info".into()),
        )
        .init();

    // Initialize Prometheus metrics
    let metrics_renderer = middleware::metrics::init_metrics();
    tracing::info!("Prometheus metrics initialized");

    // Load configuration
    dotenv::dotenv().ok();
    let config = Arc::new(Config::from_env()?);

    // Create database pool
    let pool = create_pool(&config.database_url).await?;

    // Run migrations
    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .map_err(|e| anyhow::anyhow!("Failed to run migrations: {}", e))?;

    // Create storage once at startup (shared across requests)
    let storage = create_storage(config.clone())
        .await
        .map_err(|e| anyhow::anyhow!("Failed to create storage backend: {}", e))?;

    // Build application state
    let app_state = AppState::new(config.clone(), pool, storage);

    // 后台维护任务：清理过期分块上传会话与临时目录（防止磁盘长期堆积）
    spawn_upload_session_cleanup(app_state.pool.clone(), Duration::from_secs(300), 200);

    // 后台维护任务：定期检测 DB 记录对应的物理文件是否存在，若已丢失则删除 DB 记录，避免读路径出错
    spawn_files_consistency_checker(
        app_state.pool.clone(),
        app_state.storage.clone(),
        Duration::from_secs(600),
        500,
    );

    // 后台维护任务（仅 local 存储）：扫描存储目录，删除「磁盘有文件但 DB 无记录」的孤儿文件
    if config.storage_backend == "local" {
        spawn_orphan_storage_files_cleanup(
            app_state.pool.clone(),
            config.storage_path.clone(),
            Duration::from_secs(600),
            500,
        );
        tracing::info!(
            "orphan storage files cleanup task started (storage_path={}, interval=600s, batch_limit=500)",
            config.storage_path
        );
    }

    // Build application
    let app = create_app(app_state, &config, metrics_renderer).await;

    let addr = format!("0.0.0.0:{}", config.port);
    tracing::info!("Server listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    Ok(())
}

async fn shutdown_signal() {
    let ctrl_c = async {
        let _ = tokio::signal::ctrl_c().await;
    };

    #[cfg(unix)]
    let terminate = async {
        use tokio::signal::unix::{signal, SignalKind};
        if let Ok(mut sigterm) = signal(SignalKind::terminate()) {
            sigterm.recv().await;
        }
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }

    tracing::info!("Shutdown signal received");
}

/// 创建并配置 Axum 应用
///
/// # 参数
/// - `app_state`: 应用共享状态
/// - `config`: 应用配置（用于 CORS 配置）
/// - `metrics_renderer`: Prometheus metrics 渲染器
///
/// # 返回
/// 配置完成的 Axum Router
async fn create_app<F>(app_state: AppState, config: &Config, metrics_renderer: F) -> Router
where
    F: Fn() -> String + Clone + Send + Sync + 'static,
{
    // 配置 CORS
    let cors = create_cors_layer(config);

    // 配置速率限制：每分钟 500 个请求（缩略图/预览预加载较多时易触发 429，适当放宽）
    // 增加 max_keys 上限，避免高并发/攻击场景下 key 无限增长导致内存膨胀
    let rate_limit_state = rate_limit::create_rate_limit_middleware(500, 60, 20_000);

    // 构建中间件栈
    let middleware_stack = ServiceBuilder::new()
        // 全局过载保护：限制 in-flight request 总数并快速拒绝，防止极端并发把进程拖死
        .layer(HandleErrorLayer::new(|err: BoxError| async move {
            tracing::warn!("global overload triggered: {}", err);
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
        .layer(ConcurrencyLimitLayer::new(512))
        .layer(CatchPanicLayer::new()) // 捕获 panic，避免因意外 panic 导致进程退出（panic=unwind 时尤为有用）
        .layer(TraceLayer::new_for_http()) // HTTP 请求追踪
        .layer(TimeoutLayer::new(Duration::from_secs(120))) // 120 秒超时（上传大文件更稳）
        .layer(cors) // CORS 支持
        .into_inner();

    // Metrics 端点处理器
    let metrics_handler = {
        let renderer = metrics_renderer.clone();
        move || {
            let r = renderer.clone();
            async move { r() }
        }
    };

    // 构建路由
    Router::new()
        // 健康检查端点（完整检查：数据库 + 存储）
        .route("/health", get(health_check))
        // 存活检查端点（轻量级，用于 k8s liveness probe）
        .route("/livez", get(liveness_check))
        // Prometheus metrics 端点
        .route("/metrics", get(metrics_handler))
        // 就绪检查端点（与 /health 相同，用于 k8s readiness probe）
        .route("/readyz", get(health_check))
        // OpenAPI/Swagger 文档
        .merge(create_openapi_router())
        // API v1 路由（当前版本）
        .nest("/api/v1/auth", api::auth::create_router())
        .nest("/api/v1/files", api::files::create_router())
        .nest("/api/v1/folders", api::folders::create_router())
        .nest("/api/v1/shares", api::share::create_router())
        .nest("/api/v1/tokens", api::api_token::create_router())
        // 向后兼容：旧路由重定向到 v1（可选，可在迁移后移除）
        .nest("/api/auth", api::auth::create_router())
        .nest("/api/files", api::files::create_router())
        .nest("/api/folders", api::folders::create_router())
        .nest("/api/shares", api::share::create_router())
        .nest("/api/tokens", api::api_token::create_router())
        // 注入应用状态（使用 State<AppState> 替代多个 Extension）
        .with_state(app_state)
        // 应用中间件（从外到内执行）
        .layer(axum::middleware::from_fn(metrics_middleware)) // HTTP 请求指标追踪
        .layer(axum::middleware::from_fn(move |req, next| {
            let state = rate_limit_state.clone();
            rate_limit::rate_limit_middleware(state, req, next)
        }))
        .layer(axum::middleware::from_fn(request_logger))
        .layer(middleware_stack)
}

/// 创建 CORS 中间件层
///
/// 根据配置创建适当的 CORS 策略。
fn create_cors_layer(config: &Config) -> CorsLayer {
    let cors_origin: AllowOrigin = {
        let raw = config.cors_origin.trim();
        if raw == "*" {
            Any.into()
        } else {
            let origins: Vec<axum::http::HeaderValue> = raw
                .split(',')
                .map(|s| s.trim())
                .filter(|s| !s.is_empty())
                .filter_map(|s| s.parse::<axum::http::HeaderValue>().ok())
                .collect();
            if origins.is_empty() {
                Any.into()
            } else {
                AllowOrigin::list(origins)
            }
        }
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
            axum::http::header::ACCEPT,
            axum::http::header::ORIGIN,
            axum::http::header::RANGE,
        ])
        .allow_credentials(config.cors_origin.trim() != "*")
}

/// 健康检查端点
///
/// 用于监控和负载均衡器健康检查。
/// 检查数据库连接和存储后端状态。
async fn health_check(
    axum::extract::State(state): axum::extract::State<AppState>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let mut status = "healthy";
    let mut checks = serde_json::Map::new();

    // 检查数据库连接
    let db_check = sqlx::query("SELECT 1")
        .execute(&state.pool)
        .await;
    let db_status = match db_check {
        Ok(_) => {
            checks.insert("database".to_string(), json!({ "status": "up" }));
            true
        }
        Err(e) => {
            tracing::error!("Health check: database connection failed: {}", e);
            checks.insert("database".to_string(), json!({
                "status": "down",
                "error": "connection failed"
            }));
            status = "unhealthy";
            false
        }
    };

    // 检查存储后端
    let storage_status = state.storage.health_check().await;
    let storage_ok = match &storage_status {
        Ok(_) => {
            checks.insert("storage".to_string(), json!({ "status": "up" }));
            true
        }
        Err(e) => {
            tracing::error!("Health check: storage backend failed: {}", e);
            checks.insert("storage".to_string(), json!({
                "status": "down",
                "error": format!("{}", e)
            }));
            status = "unhealthy";
            false
        }
    };

    let response = json!({
        "status": status,
        "timestamp": chrono::Utc::now().to_rfc3339(),
        "checks": checks
    });

    if db_status && storage_ok {
        Ok(Json(response))
    } else {
        Err((StatusCode::SERVICE_UNAVAILABLE, Json(response)))
    }
}

/// 轻量级存活检查（用于 k8s liveness probe）
async fn liveness_check() -> &'static str {
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
