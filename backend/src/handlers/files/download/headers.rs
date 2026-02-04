//! 下载相关的 Header 构建/复用工具。
//!
//! 目标：
//! - 避免在多个分支重复 `HeaderValue::from_str`
//! - 统一设置缓存与 Range 相关的响应头，减少遗漏/不一致风险

use axum::http::{header, HeaderMap, HeaderValue};

use crate::constants::CACHE_CONTROL_PRIVATE_REVALIDATE;
use crate::utils::AppError;

#[derive(Clone)]
pub struct EntityHeaders {
    /// 原始 ETag 字符串（用于与请求头比较）
    pub etag_str: String,
    /// ETag HeaderValue（避免重复 from_str）
    etag: HeaderValue,
    /// Last-Modified HeaderValue（避免重复 from_str）
    last_modified: HeaderValue,
}

impl EntityHeaders {
    pub fn new(etag_str: String, last_modified_str: String) -> Result<Self, AppError> {
        let etag = HeaderValue::from_str(&etag_str).map_err(|_| AppError::Internal)?;
        let last_modified =
            HeaderValue::from_str(&last_modified_str).map_err(|_| AppError::Internal)?;
        Ok(Self {
            etag_str,
            etag,
            last_modified,
        })
    }
}

pub fn apply_entity_headers(headers: &mut HeaderMap, e: &EntityHeaders) {
    headers.insert(header::ETAG, e.etag.clone());
    headers.insert(header::LAST_MODIFIED, e.last_modified.clone());
}

pub fn apply_cache_headers(headers: &mut HeaderMap, e: &EntityHeaders) {
    apply_entity_headers(headers, e);
    headers.insert(
        header::CACHE_CONTROL,
        HeaderValue::from_static(CACHE_CONTROL_PRIVATE_REVALIDATE),
    );
}

pub fn apply_range_headers(headers: &mut HeaderMap) {
    headers.insert(header::ACCEPT_RANGES, HeaderValue::from_static("bytes"));
    headers.insert(header::VARY, HeaderValue::from_static("Range"));
}
