use axum::{
    extract::Request,
    http::{HeaderMap, HeaderValue, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;
use std::{
    collections::HashMap,
    sync::Arc,
    time::{Duration, Instant},
};
use tokio::sync::RwLock;

#[derive(Clone)]
pub struct RateLimitState {
    requests: Arc<RwLock<HashMap<String, Vec<Instant>>>>,
    max_requests: usize,
    window_seconds: u64,
}

impl RateLimitState {
    fn new(max_requests: usize, window_seconds: u64) -> Self {
        Self {
            requests: Arc::new(RwLock::new(HashMap::new())),
            max_requests,
            window_seconds,
        }
    }

    async fn check_rate_limit(&self, key: &str) -> bool {
        let mut requests = self.requests.write().await;
        let now = Instant::now();
        let window_start = now - Duration::from_secs(self.window_seconds);

        // Get or create entry for this key
        let entry = requests.entry(key.to_string()).or_insert_with(Vec::new);

        // Remove old requests outside the time window
        entry.retain(|&time| time > window_start);

        // Check if limit exceeded
        if entry.len() >= self.max_requests {
            return false;
        }

        // Add current request
        entry.push(now);
        true
    }

    async fn cleanup_old_entries(&self) {
        let mut requests = self.requests.write().await;
        let now = Instant::now();
        let window_start = now - Duration::from_secs(self.window_seconds);

        requests.retain(|_, times| {
            times.retain(|&time| time > window_start);
            !times.is_empty()
        });
    }
}

pub fn create_rate_limit_middleware(max_requests: usize, window_seconds: u64) -> RateLimitState {
    let state = RateLimitState::new(max_requests, window_seconds);

    // Spawn cleanup task
    let cleanup_state = state.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(60));
        loop {
            interval.tick().await;
            cleanup_state.cleanup_old_entries().await;
        }
    });

    state
}

fn get_client_ip(headers: &HeaderMap) -> String {
    // Try X-Forwarded-For first (for proxies)
    if let Some(forwarded) = headers.get("x-forwarded-for") {
        if let Ok(forwarded_str) = forwarded.to_str() {
            if let Some(ip) = forwarded_str.split(',').next() {
                return ip.trim().to_string();
            }
        }
    }

    // Try X-Real-IP
    if let Some(real_ip) = headers.get("x-real-ip") {
        if let Ok(ip) = real_ip.to_str() {
            return ip.to_string();
        }
    }

    // Fallback to a default key (in production, you'd extract from connection)
    "unknown".to_string()
}

pub async fn rate_limit_middleware(state: RateLimitState, req: Request, next: Next) -> Response {
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

        // Set headers
        let headers = response.headers_mut();
        headers.insert(
            "X-RateLimit-Limit",
            HeaderValue::from_str(&state.max_requests.to_string()).unwrap(),
        );
        headers.insert(
            "X-RateLimit-Window",
            HeaderValue::from_str(&state.window_seconds.to_string()).unwrap(),
        );

        return response;
    }

    next.run(req).await
}
