//! 下载与预览（含 Range、缓存与预条件）
//!
//! 入口只做编排：解析请求头 -> 预条件/缓存判定 -> Range 判定 -> 交给 GET/HEAD 子模块构造响应。
//! 具体实现拆分到：
//! - `headers`：实体头/缓存头/Range 相关头复用
//! - `ranges`：Range 解析与规范化
//! - `responses`：304/412/416 等常用响应
//! - `head`：HEAD 响应构造
//! - `get`：GET 响应构造（含 body 传输）
//! - `multipart`：多段 Range（multipart/byteranges）流式 body

mod get;
mod head;
mod headers;
mod multipart;
mod ranges;
mod responses;

use axum::extract::{Path, State};
use axum::http::{header, HeaderMap, Method};
use axum::response::Response;
use uuid::Uuid;

use crate::extractors::AuthenticatedUser;
use crate::services::file::FileService;
use crate::utils::AppError;
use crate::AppState;

use headers::EntityHeaders;
use ranges::parse_ranges;
use responses::{not_modified_response, precondition_failed_response};

fn compute_etag(file_id: Uuid, updated_at_unix: i64, total_size: u64) -> String {
    // Weak ETag：用于缓存/断点续传的实用型标识（不保证字节级强一致）
    format!("W/\"{}-{}-{}\"", file_id, updated_at_unix, total_size)
}

async fn file_get_or_head_response(
    state: &AppState,
    user_id: Uuid,
    method: Method,
    headers: HeaderMap,
    file_id: Uuid,
    inline: bool,
) -> Result<Response, AppError> {
    use httpdate::{fmt_http_date, parse_http_date};
    use std::time::{Duration, SystemTime};

    let file_service = FileService::from_state(state);
    let file = file_service.get_file(file_id, user_id).await?;

    let total_size = file.file_size.max(0) as u64;
    let etag_str = compute_etag(file.id, file.updated_at.timestamp(), total_size);
    let last_modified_str = {
        let ts = file.updated_at.timestamp().max(0) as u64;
        fmt_http_date(SystemTime::UNIX_EPOCH + Duration::from_secs(ts))
    };
    let entity_headers = EntityHeaders::new(etag_str, last_modified_str)?;

    // headers
    let range_header = headers.get(header::RANGE).and_then(|v| v.to_str().ok());
    let if_none_match = headers
        .get(header::IF_NONE_MATCH)
        .and_then(|v| v.to_str().ok());
    let if_range = headers.get(header::IF_RANGE).and_then(|v| v.to_str().ok());
    let if_match = headers.get(header::IF_MATCH).and_then(|v| v.to_str().ok());
    let if_unmodified_since = headers
        .get(header::IF_UNMODIFIED_SINCE)
        .and_then(|v| v.to_str().ok());
    let if_modified_since = headers
        .get(header::IF_MODIFIED_SINCE)
        .and_then(|v| v.to_str().ok());

    // 预条件：If-Match（不匹配则 412）
    if let Some(v) = if_match {
        if v != "*" && v != entity_headers.etag_str {
            return Ok(precondition_failed_response(&entity_headers));
        }
    }

    // 预条件：If-Unmodified-Since（已被修改则 412）
    if let Some(v) = if_unmodified_since {
        if let Ok(t) = parse_http_date(v) {
            let updated_ts = file.updated_at.timestamp().max(0) as u64;
            let t_ts = t
                .duration_since(SystemTime::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs();
            if updated_ts > t_ts {
                return Ok(precondition_failed_response(&entity_headers));
            }
        }
    }

    // If-None-Match（仅在非 Range 情况下返回 304）
    if range_header.is_none() && if_none_match == Some(entity_headers.etag_str.as_str()) {
        return Ok(not_modified_response(&entity_headers));
    }

    // If-Modified-Since（仅在非 Range 情况下生效；Range 推荐用 If-Range）
    if range_header.is_none() {
        if let Some(v) = if_modified_since {
            if let Ok(t) = parse_http_date(v) {
                let updated_ts = file.updated_at.timestamp().max(0) as u64;
                let t_ts = t
                    .duration_since(SystemTime::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs();
                if updated_ts <= t_ts {
                    return Ok(not_modified_response(&entity_headers));
                }
            }
        }
    }

    // Range 解析（支持多段）
    let mut ranges = parse_ranges(range_header, total_size)?;

    // If-Range：不匹配则忽略 Range，改走全量
    //
    // 兼容两种 If-Range 语义：
    // - ETag：完全匹配才允许 Range
    // - HTTP-date：资源“未在该时间之后修改”才允许 Range
    if ranges.as_ref().map(|r| !r.is_empty()).unwrap_or(false) {
        if let Some(if_range) = if_range {
            if if_range == entity_headers.etag_str {
                // ok: ETag match
            } else if let Ok(t) = parse_http_date(if_range) {
                let updated_ts = file.updated_at.timestamp().max(0) as u64;
                let updated_time = SystemTime::UNIX_EPOCH + Duration::from_secs(updated_ts);
                if updated_time > t {
                    ranges = None;
                }
            } else {
                ranges = None;
            }
        }
    }

    if method == Method::HEAD {
        return head::build_head_response(
            &file.original_filename,
            &file.mime_type,
            inline,
            total_size,
            ranges,
            &entity_headers,
        );
    }

    get::build_get_response(state, &file, inline, total_size, ranges, &entity_headers).await
}

/// 下载文件
///
/// 返回文件内容，设置 `Content-Disposition: attachment` 触发下载。
pub async fn download_file_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
    method: Method,
    headers: HeaderMap,
    Path(file_id): Path<Uuid>,
) -> Result<Response, AppError> {
    file_get_or_head_response(&state, user_id, method, headers, file_id, false).await
}

/// 预览文件
///
/// 返回文件内容，设置 `Content-Disposition: inline` 在浏览器中显示。
pub async fn preview_file_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
    method: Method,
    headers: HeaderMap,
    Path(file_id): Path<Uuid>,
) -> Result<Response, AppError> {
    file_get_or_head_response(&state, user_id, method, headers, file_id, true).await
}
