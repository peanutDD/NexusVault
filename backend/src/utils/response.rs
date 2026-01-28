//! # Response Utilities
//!
//! 提供统一的响应构建辅助函数，确保所有 API 响应格式一致。

use axum::{
    body::Body,
    http::{header, HeaderMap, HeaderValue},
    response::{IntoResponse, Response},
    Json,
};
use serde::Serialize;
use serde_json::json;

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

/// 构建带分页信息的列表响应
///
/// # 参数
/// - `items`: 列表数据
/// - `total`: 总记录数
/// - `page`: 当前页码（可选）
/// - `limit`: 每页数量（可选）
///
/// # 示例
///
/// ```rust
/// Ok(paginated_response(files, total, Some(page), Some(limit)))
/// ```
pub fn paginated_response<T: Serialize>(
    items: Vec<T>,
    total: u64,
    page: Option<u32>,
    limit: Option<u32>,
) -> Response {
    let mut response = json!({
        "items": items,
        "total": total,
    });

    if let Some(p) = page {
        response["page"] = json!(p);
    }
    if let Some(l) = limit {
        response["limit"] = json!(l);
    }

    Json(response).into_response()
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
    // 构建 Content-Disposition header
    let disposition = if inline {
        format!("inline; filename=\"{}\"", filename)
    } else {
        format!("attachment; filename=\"{}\"", filename)
    };

    // 构建 headers
    let mut headers = HeaderMap::new();
    headers.insert(
        header::CONTENT_TYPE,
        HeaderValue::from_str(mime_type).unwrap_or_else(|_| {
            HeaderValue::from_static("application/octet-stream")
        }),
    );
    headers.insert(
        header::CONTENT_DISPOSITION,
        HeaderValue::from_str(&disposition)?,
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
    // 构建 Content-Disposition header
    let disposition = if inline {
        format!("inline; filename=\"{}\"", filename)
    } else {
        format!("attachment; filename=\"{}\"", filename)
    };

    // 构建 headers
    let mut headers = HeaderMap::new();
    headers.insert(
        header::CONTENT_TYPE,
        HeaderValue::from_str(mime_type).unwrap_or_else(|_| {
            HeaderValue::from_static("application/octet-stream")
        }),
    );
    headers.insert(
        header::CONTENT_DISPOSITION,
        HeaderValue::from_str(&disposition)?,
    );
    if let Some(len) = content_length {
        headers.insert(
            header::CONTENT_LENGTH,
            HeaderValue::from_str(&len.to_string()).unwrap_or_else(|_| HeaderValue::from_static("0")),
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
