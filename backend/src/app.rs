//! # 应用构建模块
//!
//! 负责创建并配置 Axum 应用：CORS、中间件栈、路由挂载。
//! 与 `main.rs` 中的启动流程解耦，便于测试与阅读。

use std::time::Duration;

use axum::http::StatusCode;
use axum::routing::get;
use axum::Json;
use axum::Router;
use serde_json::json;
use tower::ServiceBuilder;
use tower_http::{
    catch_panic::CatchPanicLayer,
    cors::{Any, AllowOrigin, CorsLayer},
    timeout::TimeoutLayer,
    trace::TraceLayer,
};
use tower::{limit::ConcurrencyLimitLayer, load_shed::LoadShedLayer, BoxError};

use crate::api;
use crate::config::Config;
use crate::handlers::health;
use crate::middleware;
use crate::AppState;

// ---------- 应用创建 ----------

/// 创建并配置 Axum 应用
///
/// # 参数
/// - `app_state`: 应用共享状态
/// - `config`: 应用配置（CORS、速率限制等）
/// - `metrics_renderer`: Prometheus metrics 渲染器
///
/// # 返回
/// 配置完成的 Axum Router（未 bind，由 main 负责 serve）
pub async fn create_app<F>(app_state: AppState, config: &Config, metrics_renderer: F) -> Router
where
    F: Fn() -> String + Clone + Send + Sync + 'static,
{
    let cors = create_cors_layer(config);
    let rate_limit_state = middleware::rate_limit::create_rate_limit_middleware(500, 60, 20_000);

    // Router::layer 要求 L::Service: Clone。RequestLogLayer 及其 Service 已实现 Clone。
    let middleware_stack = ServiceBuilder::new()
        .layer(axum::error_handling::HandleErrorLayer::new(
            |err: BoxError| async move {
                tracing::warn!("global overload triggered: {}", err);
                (
                    StatusCode::SERVICE_UNAVAILABLE,
                    Json(json!({
                        "error": "service overloaded",
                        "message": "服务器繁忙，请稍后重试",
                        "code": "SERVICE_OVERLOADED"
                    })),
                )
            },
        ))
        .layer(LoadShedLayer::new())
        .layer(ConcurrencyLimitLayer::new(512))
        .layer(CatchPanicLayer::custom(middleware::panic::JsonPanicHandler))
        .layer(TraceLayer::new_for_http())
        .layer(middleware::request_log::RequestLogLayer)
        .layer(TimeoutLayer::new(Duration::from_secs(120)))
        .layer(cors)
        .into_inner();

    let metrics_handler = {
        let renderer = metrics_renderer.clone();
        move || {
            let r = renderer.clone();
            async move { r() }
        }
    };

    // 按 Axum 文档：from_fn_with_state 用 route_layer 在 with_state 之前挂载。
    // 请求流向：middleware_stack（含 RequestLogLayer）-> metrics -> rate_limit -> router
    let routes = Router::new()
        .route("/health", get(health::health_check))
        .route("/livez", get(health::liveness_check))
        .route("/metrics", get(metrics_handler))
        .route("/readyz", get(health::health_check))
        .merge(api::openapi::create_openapi_router())
        .nest("/api/v1", api::create_api_routes())
        .nest("/api", api::create_api_routes())
        .route_layer(axum::middleware::from_fn_with_state(
            app_state.clone(),
            move |_state: axum::extract::State<AppState>, req, next| {
                let limit_state = rate_limit_state.clone();
                middleware::rate_limit::rate_limit_middleware(limit_state, req, next)
            },
        ))
        .route_layer(axum::middleware::from_fn_with_state(
            app_state.clone(),
            middleware::metrics::metrics_middleware,
        ));

    routes
        .with_state(app_state)
        .layer(middleware_stack)
}

// ---------- CORS ----------

/// 根据配置创建 CORS 中间件层
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
