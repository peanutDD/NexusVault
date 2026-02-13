//! # Proxy API
//!
//! 为前端提供简单的图片中转能力，用于 markdown 中的外链图片。
//! 目前仅支持 http/https，禁止访问本地地址，防止 SSRF。

use axum::{
    extract::Query,
    http::{header::CONTENT_TYPE, HeaderMap, StatusCode},
    response::IntoResponse,
    routing::get,
    Router,
};
use bytes::Bytes;
use serde::Deserialize;
use url::Url;

use crate::{utils::AppError, AppState};

/// 查询参数：要代理的图片 URL
#[derive(Debug, Deserialize)]
pub struct ProxyImageQuery {
    pub url: String,
}

/// 创建 `/proxy` 路由
pub fn create_router() -> Router<AppState> {
    Router::new().route("/image", get(proxy_image_handler))
}

/// 简单图片中转：GET /api/proxy/image?url=...
pub async fn proxy_image_handler(
    Query(params): Query<ProxyImageQuery>,
) -> Result<impl IntoResponse, AppError> {
    if params.url.trim().is_empty() {
        return Err(AppError::Validation("缺少 url 参数".into()));
    }

    let parsed =
        Url::parse(&params.url).map_err(|_| AppError::Validation("无效的图片 URL".into()))?;

    // 只允许 http/https，避免意外协议
    match parsed.scheme() {
        "http" | "https" => {}
        _ => return Err(AppError::Validation("仅支持 http/https 图片 URL".into())),
    }

    // 基本 SSRF 防护：禁止访问本地地址
    if let Some(host) = parsed.host_str() {
        let host_lower = host.to_ascii_lowercase();
        if host_lower == "localhost" || host_lower == "127.0.0.1" || host_lower == "::1" {
            return Err(AppError::Validation("不允许访问本地地址".into()));
        }
    }

    let client = reqwest::Client::new();

    let upstream = client.get(parsed).send().await.map_err(|e| {
        tracing::warn!("proxy image request failed: {}", e);
        AppError::File("图片拉取失败".into())
    })?;

    if !upstream.status().is_success() {
        tracing::warn!("proxy image upstream status: {}", upstream.status());
        return Err(AppError::File("图片拉取失败".into()));
    }
    let content_type = upstream
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .cloned();

    let body_bytes: Bytes = upstream.bytes().await.map_err(|e| {
        tracing::warn!("proxy image read body failed: {}", e);
        AppError::File("图片拉取失败".into())
    })?;

    let mut headers = HeaderMap::new();
    if let Some(ct) = content_type {
        headers.insert(CONTENT_TYPE, ct);
    }

    Ok((StatusCode::OK, headers, body_bytes))
}
