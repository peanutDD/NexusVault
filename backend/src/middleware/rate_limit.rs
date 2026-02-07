use axum::{
    extract::Request,
    http::{HeaderMap, HeaderValue, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;
use std::{
    sync::atomic::{AtomicU32, Ordering},
    sync::Arc,
    time::Duration,
};
use moka::sync::Cache;

#[derive(Clone)]
pub struct RateLimitState {
    /// 以“固定窗口 + TTL”实现的计数器：
    /// - key：客户端标识（IP）
    /// - value：窗口内请求计数
    ///
    /// 使用 Cache 的好处：
    /// - **有容量上限**（max_capacity）：避免攻击/异常流量导致 key 无限增长
    /// - **自动过期**（time_to_live）：窗口结束后自动清理，避免手写清理任务的锁竞争
    counters: Cache<String, Arc<AtomicU32>>,
    max_requests: u32,
    window_seconds: u64,
}

impl RateLimitState {
    fn new(max_requests: u32, window_seconds: u64, max_keys: u64) -> Self {
        Self {
            max_requests,
            window_seconds,
            counters: Cache::builder()
                .max_capacity(max_keys)
                .time_to_live(Duration::from_secs(window_seconds))
                .build(),
        }
    }

    async fn check_rate_limit(&self, key: &str) -> bool {
        // 固定窗口：以“首次出现的瞬间”为窗口起点，TTL 到期自动清理
        let counter = self
            .counters
            .get_with(key.to_string(), || Arc::new(AtomicU32::new(0)));

        let current = counter.fetch_add(1, Ordering::Relaxed) + 1;
        current <= self.max_requests
    }
}

pub fn create_rate_limit_middleware(
    max_requests: u32,
    window_seconds: u64,
    max_keys: u64,
) -> RateLimitState {
    RateLimitState::new(max_requests, window_seconds, max_keys)
}

fn get_client_ip(headers: &HeaderMap) -> String {
    // 使用 Option 链式调用替代嵌套 if-let
    headers
        .get("x-forwarded-for")
        .and_then(|h| h.to_str().ok())
        .and_then(|s| s.split(',').next())
        .map(|ip| ip.trim().to_string())
        .or_else(|| {
            headers
                .get("x-real-ip")
                .and_then(|h| h.to_str().ok())
                .map(str::to_string)
        })
        .unwrap_or_else(|| "unknown".to_string())
}

/// 分片上传路径：请求量大（每块一次），不参与通用限流计数，由各端点的 ConcurrencyLimit 保护即可。
fn is_chunked_upload_path(path: &str) -> bool {
    path.contains("upload/chunked")
}

pub async fn rate_limit_middleware(state: RateLimitState, req: Request, next: Next) -> Response {
    let path = req.uri().path();
    if is_chunked_upload_path(path) {
        return next.run(req).await;
    }

    let key = get_client_ip(req.headers());

    if !state.check_rate_limit(&key).await {
        let mut response = (
            StatusCode::TOO_MANY_REQUESTS,
            [
                ("X-RateLimit-Limit", state.max_requests.to_string()),
                ("X-RateLimit-Window", state.window_seconds.to_string()),
            ],
            Json(json!({
                "error": "Too many requests",
                "message": "请求过于频繁，请稍后再试",
                "code": "RATE_LIMIT_EXCEEDED"
            })),
        )
            .into_response();

        // Set headers (HeaderValue::from_str for numeric strings should not fail)
        let headers = response.headers_mut();
        if let Ok(limit_val) = HeaderValue::from_str(&state.max_requests.to_string()) {
            headers.insert("X-RateLimit-Limit", limit_val);
        }
        if let Ok(window_val) = HeaderValue::from_str(&state.window_seconds.to_string()) {
            headers.insert("X-RateLimit-Window", window_val);
        }

        return response;
    }

    next.run(req).await
}
