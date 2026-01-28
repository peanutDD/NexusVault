//! HEAD 响应构造（不传输 body）。

use axum::body::Body;
use axum::http::{header, HeaderValue, StatusCode};
use axum::response::Response;
use uuid::Uuid;

use crate::utils::{stream_file_response, AppError};

use super::headers::{apply_cache_headers, apply_range_headers, EntityHeaders};
use super::ranges::ByteRange;
use super::responses::range_not_satisfiable_response;

pub fn build_head_response(
    original_filename: &str,
    mime_type: &str,
    inline: bool,
    total_size: u64,
    ranges: Option<Vec<ByteRange>>,
    entity_headers: &EntityHeaders,
) -> Result<Response, AppError> {
    if let Some(ranges) = ranges {
        if ranges.is_empty() {
            return range_not_satisfiable_response(total_size, entity_headers);
        }

        if ranges.len() > 1 {
            // HEAD + multi-range：只回 headers，不算 Content-Length（multipart 会走 chunked）
            let boundary = format!("BOUNDARY-{}", Uuid::new_v4());
            let mut res =
                stream_file_response(Body::empty(), original_filename, mime_type, inline, None)
                    .map_err(|_| AppError::Internal)?;
            *res.status_mut() = StatusCode::PARTIAL_CONTENT;
            res.headers_mut().insert(
                header::CONTENT_TYPE,
                HeaderValue::from_str(&format!("multipart/byteranges; boundary={}", boundary))
                    .map_err(|_| AppError::Internal)?,
            );
            apply_cache_headers(res.headers_mut(), entity_headers);
            apply_range_headers(res.headers_mut());
            return Ok(res);
        }

        let (start, end) = ranges[0];
        if start >= total_size || start > end {
            return range_not_satisfiable_response(total_size, entity_headers);
        }

        let end = end.min(total_size.saturating_sub(1));
        let len = end - start + 1;

        let mut res = stream_file_response(
            Body::empty(),
            original_filename,
            mime_type,
            inline,
            Some(len),
        )
        .map_err(|_| AppError::Internal)?;
        *res.status_mut() = StatusCode::PARTIAL_CONTENT;
        res.headers_mut().insert(
            header::CONTENT_RANGE,
            HeaderValue::from_str(&format!("bytes {}-{}/{}", start, end, total_size))
                .map_err(|_| AppError::Internal)?,
        );
        apply_cache_headers(res.headers_mut(), entity_headers);
        apply_range_headers(res.headers_mut());
        return Ok(res);
    }

    let mut res = stream_file_response(
        Body::empty(),
        original_filename,
        mime_type,
        inline,
        Some(total_size),
    )
    .map_err(|_| AppError::Internal)?;
    apply_cache_headers(res.headers_mut(), entity_headers);
    apply_range_headers(res.headers_mut());
    Ok(res)
}
