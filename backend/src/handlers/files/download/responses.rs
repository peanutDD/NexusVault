//! 常用响应构造（304/412/416 等）。

use axum::http::{header, HeaderValue, StatusCode};
use axum::response::{IntoResponse, Response};

use crate::utils::AppError;

use super::headers::{
    apply_cache_headers, apply_entity_headers, apply_range_headers, EntityHeaders,
};

pub fn precondition_failed_response(e: &EntityHeaders) -> Response {
    let mut res = StatusCode::PRECONDITION_FAILED.into_response();
    apply_entity_headers(res.headers_mut(), e);
    res
}

/// 返回 304 Not Modified 响应
/// - `inline=true`: 预览场景，使用预览缓存策略
/// - `inline=false`: 下载场景，使用下载缓存策略
pub fn not_modified_response(e: &EntityHeaders, inline: bool) -> Response {
    // 打印一条 304 命中日志，便于在日志中观察缓存命中情况
    tracing::debug!(
        etag = %e.etag_str,
        inline = inline,
        "returning 304 Not Modified for file preview/download"
    );

    let mut res = StatusCode::NOT_MODIFIED.into_response();
    apply_cache_headers(res.headers_mut(), e, inline);
    apply_range_headers(res.headers_mut());
    res
}

pub fn range_not_satisfiable_response(
    total_size: u64,
    e: &EntityHeaders,
) -> Result<Response, AppError> {
    let mut res = StatusCode::RANGE_NOT_SATISFIABLE.into_response();
    res.headers_mut().insert(
        header::CONTENT_RANGE,
        HeaderValue::from_str(&format!("bytes */{}", total_size))
            .map_err(|_| AppError::Internal)?,
    );
    apply_entity_headers(res.headers_mut(), e);
    apply_range_headers(res.headers_mut());
    Ok(res)
}
