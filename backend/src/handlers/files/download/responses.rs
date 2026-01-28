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

pub fn not_modified_response(e: &EntityHeaders) -> Response {
    let mut res = StatusCode::NOT_MODIFIED.into_response();
    apply_cache_headers(res.headers_mut(), e);
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
