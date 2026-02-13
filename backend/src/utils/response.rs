//! # Response Utilities
//!
//! 提供统一的响应构建辅助函数，确保所有 API 响应格式一致。

use axum::{
    body::Body,
    http::{header, HeaderMap, HeaderValue},
    response::{IntoResponse, Response},
    Json,
};
use percent_encoding::{utf8_percent_encode, NON_ALPHANUMERIC};
use serde::Serialize;
use serde_json::json;

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
    Json(data).into_response()
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
