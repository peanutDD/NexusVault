use axum::{
    extract::Request,
    http::{HeaderMap, HeaderValue, Method, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
    Json,
};
use deadpool_redis::Pool as RedisPool;
use deadpool_redis::redis::cmd;
use moka::sync::Cache;
use serde_json::json;
use std::{
    sync::atomic::{AtomicU32, Ordering},
    sync::Arc,
    time::Duration,
};
use uuid::Uuid;

use crate::extractors::auth::extract_user_id_from_headers;
use crate::AppState;

#[derive(Clone)]
pub struct RateLimitState {
    /// 以“固定窗口 + TTL”实现的 IP 级计数器：
    /// - key：客户端标识（IP）
    /// - value：窗口内请求计数
    ip_counters: Cache<String, Arc<AtomicU32>>,
    ip_max_requests: u32,
    /// 已登录用户写操作的计数器：
    /// - key：`user:{user_id}`
    /// - value：窗口内写请求计数
    user_counters: Cache<String, Arc<AtomicU32>>,
    user_max_requests: u32,
    /// 固定窗口大小（秒），IP 与 user 共用同一窗口长度
    window_seconds: u64,
    redis: Option<RedisPool>,
}

impl RateLimitState {
    fn new(
        ip_max_requests: u32,
        user_max_requests: u32,
        window_seconds: u64,
        max_keys: u64,
        redis: Option<RedisPool>,
    ) -> Self {
        let ttl = Duration::from_secs(window_seconds);
        Self {
            ip_max_requests,
            user_max_requests,
            window_seconds,
            ip_counters: Cache::builder()
                .max_capacity(max_keys)
                .time_to_live(ttl)
                .build(),
            user_counters: Cache::builder()
                .max_capacity(max_keys)
                .time_to_live(ttl)
                .build(),
            redis,
        }
    }

    async fn check_ip_rate_limit(&self, key: &str) -> bool {
        if let Some(pool) = &self.redis {
            let mut conn = match pool.get().await {
                Ok(c) => c,
                Err(e) => {
                    tracing::warn!("rate_limit redis get connection failed: {}", e);
                    return true;
                }
            };
            let redis_key = format!("rl:ip:{}", key);
            let current: i64 = match cmd("INCR").arg(&redis_key).query_async(&mut conn).await {
                Ok(v) => v,
                Err(e) => {
                    tracing::warn!("rate_limit redis incr failed: {}", e);
                    return true;
                }
            };
            if current == 1 {
                let _: Result<(), _> = cmd("EXPIRE")
                    .arg(redis_key)
                    .arg(self.window_seconds as usize)
                    .query_async(&mut conn)
                    .await;
            }
            return current as u32 <= self.ip_max_requests;
        }
        let counter = self
            .ip_counters
            .get_with(key.to_string(), || Arc::new(AtomicU32::new(0)));
        let current = counter.fetch_add(1, Ordering::Relaxed) + 1;
        current <= self.ip_max_requests
    }

    async fn check_user_rate_limit(&self, key: &str) -> bool {
        if let Some(pool) = &self.redis {
            let mut conn = match pool.get().await {
                Ok(c) => c,
                Err(e) => {
                    tracing::warn!("rate_limit redis get connection failed: {}", e);
                    return true;
                }
            };
            let redis_key = format!("rl:user:{}", key);
            let current: i64 = match cmd("INCR").arg(&redis_key).query_async(&mut conn).await {
                Ok(v) => v,
                Err(e) => {
                    tracing::warn!("rate_limit redis incr failed: {}", e);
                    return true;
                }
            };
            if current == 1 {
                let _: Result<(), _> = cmd("EXPIRE")
                    .arg(redis_key)
                    .arg(self.window_seconds as usize)
                    .query_async(&mut conn)
                    .await;
            }
            return current as u32 <= self.user_max_requests;
        }
        let counter = self
            .user_counters
            .get_with(key.to_string(), || Arc::new(AtomicU32::new(0)));
        let current = counter.fetch_add(1, Ordering::Relaxed) + 1;
        current <= self.user_max_requests
    }
}

pub fn create_rate_limit_middleware(
    ip_max_requests: u32,
    user_max_requests: u32,
    window_seconds: u64,
    max_keys: u64,
    redis: Option<RedisPool>,
) -> RateLimitState {
    RateLimitState::new(
        ip_max_requests,
        user_max_requests,
        window_seconds,
        max_keys,
        redis,
    )
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

/// 已登录写操作：按 user_id 限流的目标路径前缀。
fn is_user_scoped_write(method: &Method, path: &str) -> bool {
    let is_write_method = matches!(method, &Method::POST | &Method::PUT | &Method::DELETE);
    if !is_write_method {
        return false;
    }

    // 仅对文件 / 文件夹 / 分享 / 组织相关写操作做 user 级限流
    path.starts_with("/api/files")
        || path.starts_with("/api/v1/files")
        || path.starts_with("/api/folders")
        || path.starts_with("/api/v1/folders")
        || path.starts_with("/api/shares")
        || path.starts_with("/api/v1/shares")
        || path.starts_with("/api/org")
        || path.starts_with("/api/v1/org")
}

pub async fn rate_limit_middleware(
    app_state: AppState,
    state: RateLimitState,
    req: Request,
    next: Next,
) -> Response {
    let path = req.uri().path().to_string();
    if is_chunked_upload_path(&path) {
        return next.run(req).await;
    }

    let method = req.method().clone();
    let ip_key = get_client_ip(req.headers());

    // 1. 全局 IP 级限流（包含所有请求）
    if !state.check_ip_rate_limit(&ip_key).await {
        let mut response = (
            StatusCode::TOO_MANY_REQUESTS,
            [
                ("X-RateLimit-Limit", state.ip_max_requests.to_string()),
                ("X-RateLimit-Window", state.window_seconds.to_string()),
            ],
            Json(json!({
                "error": "Too many requests",
                "message": "来自当前 IP 的请求过于频繁，请稍后再试",
                "code": "IP_RATE_LIMIT_EXCEEDED"
            })),
        )
            .into_response();

        let headers = response.headers_mut();
        if let Ok(limit_val) = HeaderValue::from_str(&state.ip_max_requests.to_string()) {
            headers.insert("X-RateLimit-Limit", limit_val);
        }
        if let Ok(window_val) = HeaderValue::from_str(&state.window_seconds.to_string()) {
            headers.insert("X-RateLimit-Window", window_val);
        }

        return response;
    }

    // 2. 针对「已登录用户写操作」的 user 级限流
    if is_user_scoped_write(&method, &path) {
        // 复用认证模块的 header 解析逻辑；失败时视为“无 user_id”，退回到 IP 级限流保护
        let user_id: Option<Uuid> =
            extract_user_id_from_headers(req.headers(), app_state.config.as_ref(), &app_state.pool)
                .await
                .ok();

        if let Some(user_id) = user_id {
            let user_key = format!("user:{}", user_id);
            if !state.check_user_rate_limit(&user_key).await {
                let mut response = (
                    StatusCode::TOO_MANY_REQUESTS,
                    [
                        ("X-RateLimit-Limit", state.user_max_requests.to_string()),
                        ("X-RateLimit-Window", state.window_seconds.to_string()),
                    ],
                    Json(json!({
                        "error": "Too many requests",
                        "message": "当前账号写操作过于频繁，请稍后再试",
                        "code": "USER_WRITE_RATE_LIMIT_EXCEEDED"
                    })),
                )
                    .into_response();

                let headers = response.headers_mut();
                if let Ok(limit_val) = HeaderValue::from_str(&state.user_max_requests.to_string()) {
                    headers.insert("X-RateLimit-Limit", limit_val);
                }
                if let Ok(window_val) = HeaderValue::from_str(&state.window_seconds.to_string()) {
                    headers.insert("X-RateLimit-Window", window_val);
                }

                return response;
            }
        }
    }

    next.run(req).await
}
