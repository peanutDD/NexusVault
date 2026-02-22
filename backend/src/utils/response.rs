//! # Response Utilities
//!
//! 提供统一的响应构建辅助函数，确保所有 API 响应格式一致。

use axum::{
    body::Body,
    http::{header, HeaderMap, HeaderValue},
    response::{IntoResponse, Response},
    Json,
};
use chrono::Utc;
use percent_encoding::{utf8_percent_encode, NON_ALPHANUMERIC};
use serde::Serialize;
use serde_json::json;
use uuid::Uuid;

// =============================================================================
// Header 辅助
// =============================================================================
fn ascii_filename_fallback(filename: &str) -> String {
    // 仅保留一部分安全 ASCII 字符作为 fallback，避免 HeaderValue::from_str 失败
    let mut out = String::with_capacity(filename.len().min(128));
    for ch in filename.chars() {
        if ch.is_ascii_alphanumeric() || matches!(ch, '.' | '-' | '_' | ' ') {
            out.push(ch);
        } else {
            out.push('_');
        }
        if out.len() >= 128 {
            break;
        }
    }
    let trimmed = out.trim().to_string();
    if trimmed.is_empty() {
        "download".to_string()
    } else {
        trimmed
    }
}

fn content_disposition_value(filename: &str, inline: bool) -> String {
    let disposition_type = if inline { "inline" } else { "attachment" };
    let ascii = ascii_filename_fallback(filename).replace('"', "_");
    let encoded = utf8_percent_encode(filename, NON_ALPHANUMERIC).to_string();
    format!("{disposition_type}; filename=\"{ascii}\"; filename*=UTF-8''{encoded}")
}

/// 判断是否为应强制下载的“潜在危险” MIME 类型（如 HTML / SVG）。
///
/// 对这些类型，即便调用方请求 `inline = true`，也会自动降级为 `attachment`，
/// 防止浏览器在当前站点上下文中直接渲染执行（XSS / SVG 脚本等）。
fn is_dangerous_mime(mime_type: &str) -> bool {
    let mt = mime_type.to_ascii_lowercase();
    mt == "text/html"
        || mt.starts_with("text/html;")
        || mt == "application/xhtml+xml"
        || mt.starts_with("application/xhtml+xml;")
        || mt == "image/svg+xml"
        || mt.starts_with("image/svg+xml;")
}

// =============================================================================
// JSON 响应
// =============================================================================
//
// 默认使用 "private, no-store" 的原因：
// - 大多数 API 响应是用户态数据（Authorization / Query token）
// - 避免浏览器/代理误缓存敏感响应体
/// 构建标准的 JSON 成功响应
///
/// # 示例
///
/// ```rust
/// Ok(json_response(json!({
///     "message": "操作成功",
///     "data": result
/// })))
/// ```
pub fn json_response<T: Serialize>(data: T) -> Response {
    let mut res = Json(data).into_response();
    res.headers_mut().insert(
        header::CACHE_CONTROL,
        HeaderValue::from_static("private, no-store"),
    );
    res
}

// 给非 AppError 场景（如中间件）复用的标准 JSON 错误体，保证客户端只需解析一套结构。
pub fn error_response(status: axum::http::StatusCode, code: &str, message: &str) -> Response {
    let error_id = Uuid::new_v4().to_string()[..8].to_string();
    let timestamp = Utc::now().to_rfc3339();
    let mut res = (
        status,
        Json(json!({
            "message": message,
            "code": code,
            "error_id": error_id,
            "timestamp": timestamp,
        })),
    )
        .into_response();
    res.headers_mut().insert(
        header::CACHE_CONTROL,
        HeaderValue::from_static("private, no-store"),
    );
    res
}

// =============================================================================
// 媒体响应
// =============================================================================
//
// HLS 生成中：
// - hls.js 期待拿到 m3u8；若返回 JSON，通常会表现为 fatal network error
// - 503 + Retry-After 表达“尚未就绪，请稍后重试”，便于播放器实现温和重试
pub fn hls_processing_response(retry_after_seconds: u32) -> Response {
    let mut headers = HeaderMap::new();
    headers.insert(
        header::CONTENT_TYPE,
        HeaderValue::from_static("application/vnd.apple.mpegurl"),
    );
    headers.insert(
        header::CACHE_CONTROL,
        HeaderValue::from_static("private, no-store"),
    );
    if let Ok(v) = HeaderValue::from_str(&retry_after_seconds.to_string()) {
        headers.insert(header::RETRY_AFTER, v);
    }
    let body =
        Body::from("#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:1\n#EXT-X-MEDIA-SEQUENCE:0\n");
    (axum::http::StatusCode::SERVICE_UNAVAILABLE, headers, body).into_response()
}

/// 构建文件下载响应
///
/// # 参数
/// - `data`: 文件内容
/// - `filename`: 文件名
/// - `mime_type`: MIME 类型
/// - `inline`: 是否内联显示（true）还是下载（false）
///
/// # 示例
///
/// ```rust
/// Ok(file_response(file_data, "document.pdf", "application/pdf", false))
/// ```
pub fn file_response(
    data: Vec<u8>,
    filename: &str,
    mime_type: &str,
    inline: bool,
) -> Result<Response, axum::http::Error> {
    // 对 HTML / SVG 等潜在危险类型强制以附件形式返回，避免在当前页面内直接执行。
    let effective_inline = inline && !is_dangerous_mime(mime_type);

    // 构建 Content-Disposition header（RFC5987 filename* 支持 UTF-8）
    let disposition = content_disposition_value(filename, effective_inline);

    // 构建 headers
    let mut headers = HeaderMap::new();
    headers.insert(
        header::CONTENT_TYPE,
        HeaderValue::from_str(mime_type)
            .unwrap_or_else(|_| HeaderValue::from_static("application/octet-stream")),
    );
    headers.insert(
        header::CONTENT_DISPOSITION,
        HeaderValue::from_str(&disposition)?,
    );
    headers.insert(
        header::X_CONTENT_TYPE_OPTIONS,
        HeaderValue::from_static("nosniff"),
    );

    Ok((headers, data).into_response())
}

/// 构建“流式”文件响应（下载/预览），避免一次性读入内存。
///
/// - `content_length`：可选，若已知可设置，有利于客户端进度展示与缓存策略
pub fn stream_file_response(
    body: Body,
    filename: &str,
    mime_type: &str,
    inline: bool,
    content_length: Option<u64>,
) -> Result<Response, axum::http::Error> {
    // 对 HTML / SVG 等潜在危险类型强制以附件形式返回，避免在当前页面内直接执行。
    let effective_inline = inline && !is_dangerous_mime(mime_type);

    // 构建 Content-Disposition header（RFC5987 filename* 支持 UTF-8）
    let disposition = content_disposition_value(filename, effective_inline);

    // 构建 headers
    let mut headers = HeaderMap::new();
    headers.insert(
        header::CONTENT_TYPE,
        HeaderValue::from_str(mime_type)
            .unwrap_or_else(|_| HeaderValue::from_static("application/octet-stream")),
    );
    headers.insert(
        header::CONTENT_DISPOSITION,
        HeaderValue::from_str(&disposition)?,
    );
    headers.insert(
        header::X_CONTENT_TYPE_OPTIONS,
        HeaderValue::from_static("nosniff"),
    );
    if let Some(len) = content_length {
        headers.insert(
            header::CONTENT_LENGTH,
            HeaderValue::from_str(&len.to_string())
                .unwrap_or_else(|_| HeaderValue::from_static("0")),
        );
    }

    Ok((headers, body).into_response())
}

/// 构建简单的成功消息响应
///
/// # 示例
///
/// ```rust
/// Ok(success_response("操作成功"))
/// ```
pub fn success_response(message: &str) -> Response {
    json_response(json!({
        "message": message,
        "success": true
    }))
}
