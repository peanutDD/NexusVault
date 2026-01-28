//! # File Handlers
//!
//! 处理文件相关的 HTTP 请求，包括：
//! - 文件上传（普通和分块上传）
//! - 文件列表和查询
//! - 文件下载和预览
//! - 文件删除（单个和批量）
//! - 文件分类管理
//! - 存储配额查询
//!
//! ## 设计原则
//!
//! 1. **职责单一**: 每个 handler 只负责 HTTP 请求处理和响应构建
//! 2. **业务逻辑分离**: 所有业务逻辑都在 `FileService` 中
//! 3. **统一认证**: 使用 `AuthenticatedUser` extractor 自动处理认证
//! 4. **统一响应**: 使用 `utils::response` 中的辅助函数构建响应

use axum::extract::{Multipart, Path, Query, State};
use axum::http::{header, HeaderMap, HeaderValue, Method, StatusCode};
use axum::response::{IntoResponse, Response};
use bytes::Bytes;
use serde_json::json;
use std::collections::HashMap;
use uuid::Uuid;

use crate::extractors::AuthenticatedUser;
use crate::models::file::{BatchDeleteRequest, BatchMoveRequest, FileListQuery};
use crate::models::upload_session::{CompleteChunkedUploadRequest, InitChunkedUploadRequest};
use crate::services::file::FileService;
use crate::services::storage::StorageReadStream;
use crate::utils::{
    file_response, json_response, parse_part_number, parse_uuid_list, stream_file_response,
    success_response, AppError,
};
use crate::AppState;

fn compute_etag(file_id: Uuid, updated_at_unix: i64, total_size: u64) -> String {
    // Weak ETag：用于缓存/断点续传的实用型标识（不保证字节级强一致）
    format!("W/\"{}-{}-{}\"", file_id, updated_at_unix, total_size)
}

const MAX_RANGES: usize = 8;

fn parse_ranges(
    range_header: Option<&str>,
    total_size: u64,
) -> Result<Option<Vec<(u64, u64)>>, AppError> {
    let Some(r) = range_header else {
        return Ok(None);
    };

    if total_size == 0 {
        return Err(AppError::Validation("空文件不支持 Range".to_string()));
    }

    let Some(rest) = r.strip_prefix("bytes=") else {
        return Err(AppError::Validation("无效的 Range".to_string()));
    };

    let mut ranges = Vec::<(u64, u64)>::new();
    for part in rest.split(',') {
        if ranges.len() >= MAX_RANGES {
            return Err(AppError::Validation("Range 段数过多".to_string()));
        }
        let part = part.trim();
        let Some((a, b)) = part.split_once('-') else {
            return Err(AppError::Validation("无效的 Range".to_string()));
        };
        let a = a.trim();
        let b = b.trim();

        let (mut start, mut end) = if a.is_empty() {
            // -suffix
            let suffix: u64 = b
                .parse()
                .map_err(|_| AppError::Validation("无效的 Range（suffix）".to_string()))?;
            let len = suffix.min(total_size);
            (total_size - len, total_size - 1)
        } else {
            let start: u64 = a
                .parse()
                .map_err(|_| AppError::Validation("无效的 Range（start）".to_string()))?;
            let end: u64 = if b.is_empty() {
                total_size - 1
            } else {
                b.parse()
                    .map_err(|_| AppError::Validation("无效的 Range（end）".to_string()))?
            };
            (start, end)
        };

        if start >= total_size {
            continue;
        }
        end = end.min(total_size - 1);
        if start > end {
            continue;
        }
        ranges.push((start, end));
    }

    if ranges.is_empty() {
        return Ok(Some(vec![]));
    }

    // 规范化：排序并合并重叠/相邻区间，避免重复读
    ranges.sort_by_key(|(s, _)| *s);
    let mut merged = Vec::<(u64, u64)>::with_capacity(ranges.len());
    for (s, e) in ranges {
        if let Some(last) = merged.last_mut() {
            if s <= last.1.saturating_add(1) {
                last.1 = last.1.max(e);
                continue;
            }
        }
        merged.push((s, e));
    }

    Ok(Some(merged))
}

async fn file_get_or_head_response(
    state: &AppState,
    user_id: Uuid,
    method: Method,
    headers: HeaderMap,
    file_id: Uuid,
    inline: bool,
) -> Result<Response, AppError> {
    use axum::body::Body;
    use tokio::io::{AsyncReadExt, AsyncSeekExt};
    use tokio_util::io::ReaderStream;
    use std::time::{Duration, SystemTime};
    use httpdate::{fmt_http_date, parse_http_date};

    let file_service = FileService::from_state(state);
    let file = file_service.get_file(file_id, user_id).await?;

    let total_size = file.file_size.max(0) as u64;
    let etag = compute_etag(file.id, file.updated_at.timestamp(), total_size);
    let last_modified = {
        let ts = file.updated_at.timestamp().max(0) as u64;
        fmt_http_date(SystemTime::UNIX_EPOCH + Duration::from_secs(ts))
    };

    let range_header = headers.get(header::RANGE).and_then(|v| v.to_str().ok());
    let if_none_match = headers
        .get(header::IF_NONE_MATCH)
        .and_then(|v| v.to_str().ok());
    let if_range = headers
        .get(header::IF_RANGE)
        .and_then(|v| v.to_str().ok());
    let if_match = headers.get(header::IF_MATCH).and_then(|v| v.to_str().ok());
    let if_unmodified_since = headers
        .get(header::IF_UNMODIFIED_SINCE)
        .and_then(|v| v.to_str().ok());
    let if_modified_since = headers
        .get(header::IF_MODIFIED_SINCE)
        .and_then(|v| v.to_str().ok());

    // 预条件：If-Match（不匹配则 412）
    if let Some(v) = if_match {
        if v != "*" && v != etag {
            let mut res = StatusCode::PRECONDITION_FAILED.into_response();
            res.headers_mut().insert(
                header::ETAG,
                HeaderValue::from_str(&etag).map_err(|_| AppError::Internal)?,
            );
            res.headers_mut().insert(
                header::LAST_MODIFIED,
                HeaderValue::from_str(&last_modified).map_err(|_| AppError::Internal)?,
            );
            return Ok(res);
        }
    }

    // 预条件：If-Unmodified-Since（已被修改则 412）
    if let Some(v) = if_unmodified_since {
        if let Ok(t) = parse_http_date(v) {
            // 若 updated_at > t，则不满足“未修改”
            let updated_ts = file.updated_at.timestamp().max(0) as u64;
            let t_ts = t
                .duration_since(SystemTime::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs();
            if updated_ts > t_ts {
                let mut res = StatusCode::PRECONDITION_FAILED.into_response();
                res.headers_mut().insert(
                    header::ETAG,
                    HeaderValue::from_str(&etag).map_err(|_| AppError::Internal)?,
                );
                res.headers_mut().insert(
                    header::LAST_MODIFIED,
                    HeaderValue::from_str(&last_modified).map_err(|_| AppError::Internal)?,
                );
                return Ok(res);
            }
        }
    }

    // If-None-Match（仅在非 Range 情况下返回 304）
    if range_header.is_none() && if_none_match == Some(etag.as_str()) {
        let mut res = StatusCode::NOT_MODIFIED.into_response();
        res.headers_mut().insert(
            header::ETAG,
            HeaderValue::from_str(&etag).map_err(|_| AppError::Internal)?,
        );
        res.headers_mut().insert(
            header::LAST_MODIFIED,
            HeaderValue::from_str(&last_modified).map_err(|_| AppError::Internal)?,
        );
        res.headers_mut().insert(
            header::CACHE_CONTROL,
            HeaderValue::from_static("private, max-age=0, must-revalidate"),
        );
        res.headers_mut()
            .insert(header::ACCEPT_RANGES, HeaderValue::from_static("bytes"));
        res.headers_mut().insert(
            header::VARY,
            HeaderValue::from_static("Range"),
        );
        return Ok(res);
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
                    let mut res = StatusCode::NOT_MODIFIED.into_response();
                    res.headers_mut().insert(
                        header::ETAG,
                        HeaderValue::from_str(&etag).map_err(|_| AppError::Internal)?,
                    );
                    res.headers_mut().insert(
                        header::LAST_MODIFIED,
                        HeaderValue::from_str(&last_modified).map_err(|_| AppError::Internal)?,
                    );
                    res.headers_mut().insert(
                        header::CACHE_CONTROL,
                        HeaderValue::from_static("private, max-age=0, must-revalidate"),
                    );
                    res.headers_mut()
                        .insert(header::ACCEPT_RANGES, HeaderValue::from_static("bytes"));
                    res.headers_mut().insert(
                        header::VARY,
                        HeaderValue::from_static("Range"),
                    );
                    return Ok(res);
                }
            }
        }
    }

    // 解析 Range（支持多段）
    let mut ranges = parse_ranges(range_header, total_size)?;

    // If-Range：不匹配则忽略 Range，改走全量
    if ranges.as_ref().map(|r| !r.is_empty()).unwrap_or(false) {
        if let Some(if_range) = if_range {
            if if_range != etag {
                ranges = None;
            }
        }
    }

    // HEAD：只返回 headers，不读取/传输 body
    if method == Method::HEAD {
        if let Some(ranges) = &ranges {
            if ranges.is_empty() {
                let mut res = StatusCode::RANGE_NOT_SATISFIABLE.into_response();
                res.headers_mut().insert(
                    header::CONTENT_RANGE,
                    HeaderValue::from_str(&format!("bytes */{}", total_size))
                        .map_err(|_| AppError::Internal)?,
                );
                res.headers_mut().insert(
                    header::ETAG,
                    HeaderValue::from_str(&etag).map_err(|_| AppError::Internal)?,
                );
                res.headers_mut().insert(
                    header::LAST_MODIFIED,
                    HeaderValue::from_str(&last_modified).map_err(|_| AppError::Internal)?,
                );
                res.headers_mut()
                    .insert(header::ACCEPT_RANGES, HeaderValue::from_static("bytes"));
                return Ok(res);
            }

            if ranges.len() > 1 {
                // HEAD + multi-range：只回 headers，不算 Content-Length（multipart 会走 chunked）
                let boundary = format!("BOUNDARY-{}", Uuid::new_v4());
                let mut res = stream_file_response(
                    Body::empty(),
                    &file.original_filename,
                    &file.mime_type,
                    inline,
                    None,
                )
                .map_err(|_| AppError::Internal)?;
                *res.status_mut() = StatusCode::PARTIAL_CONTENT;
                res.headers_mut().insert(
                    header::CONTENT_TYPE,
                    HeaderValue::from_str(&format!("multipart/byteranges; boundary={}", boundary))
                        .map_err(|_| AppError::Internal)?,
                );
                res.headers_mut().insert(
                    header::ETAG,
                    HeaderValue::from_str(&etag).map_err(|_| AppError::Internal)?,
                );
                res.headers_mut().insert(
                    header::LAST_MODIFIED,
                    HeaderValue::from_str(&last_modified).map_err(|_| AppError::Internal)?,
                );
                res.headers_mut().insert(
                    header::CACHE_CONTROL,
                    HeaderValue::from_static("private, max-age=0, must-revalidate"),
                );
                res.headers_mut()
                    .insert(header::ACCEPT_RANGES, HeaderValue::from_static("bytes"));
                res.headers_mut().insert(
                    header::VARY,
                    HeaderValue::from_static("Range"),
                );
                return Ok(res);
            }

            let (start, end_raw) = ranges[0];
            if start >= total_size || start > end_raw {
                let mut res = StatusCode::RANGE_NOT_SATISFIABLE.into_response();
                res.headers_mut().insert(
                    header::CONTENT_RANGE,
                    HeaderValue::from_str(&format!("bytes */{}", total_size))
                        .map_err(|_| AppError::Internal)?,
                );
                res.headers_mut().insert(
                    header::ETAG,
                    HeaderValue::from_str(&etag).map_err(|_| AppError::Internal)?,
                );
                res.headers_mut().insert(
                    header::LAST_MODIFIED,
                    HeaderValue::from_str(&last_modified).map_err(|_| AppError::Internal)?,
                );
                res.headers_mut()
                    .insert(header::ACCEPT_RANGES, HeaderValue::from_static("bytes"));
                return Ok(res);
            }

            let end = end_raw.min(total_size.saturating_sub(1));
            let len = end - start + 1;

            let mut res = stream_file_response(
                Body::empty(),
                &file.original_filename,
                &file.mime_type,
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
            res.headers_mut().insert(
                header::ETAG,
                HeaderValue::from_str(&etag).map_err(|_| AppError::Internal)?,
            );
            res.headers_mut().insert(
                header::LAST_MODIFIED,
                HeaderValue::from_str(&last_modified).map_err(|_| AppError::Internal)?,
            );
            res.headers_mut().insert(
                header::CACHE_CONTROL,
                HeaderValue::from_static("private, max-age=0, must-revalidate"),
            );
            res.headers_mut()
                .insert(header::ACCEPT_RANGES, HeaderValue::from_static("bytes"));
            res.headers_mut().insert(
                header::VARY,
                HeaderValue::from_static("Range"),
            );
            return Ok(res);
        }

        let mut res = stream_file_response(
            Body::empty(),
            &file.original_filename,
            &file.mime_type,
            inline,
            Some(total_size),
        )
        .map_err(|_| AppError::Internal)?;
        res.headers_mut().insert(
            header::ETAG,
            HeaderValue::from_str(&etag).map_err(|_| AppError::Internal)?,
        );
        res.headers_mut().insert(
            header::LAST_MODIFIED,
            HeaderValue::from_str(&last_modified).map_err(|_| AppError::Internal)?,
        );
        res.headers_mut().insert(
            header::CACHE_CONTROL,
            HeaderValue::from_static("private, max-age=0, must-revalidate"),
        );
        res.headers_mut()
            .insert(header::ACCEPT_RANGES, HeaderValue::from_static("bytes"));
        res.headers_mut().insert(
            header::VARY,
            HeaderValue::from_static("Range"),
        );
        return Ok(res);
    }

    // GET：Range / full body
    if let Some(ranges) = ranges {
        if ranges.is_empty() {
            let mut res = StatusCode::RANGE_NOT_SATISFIABLE.into_response();
            res.headers_mut().insert(
                header::CONTENT_RANGE,
                HeaderValue::from_str(&format!("bytes */{}", total_size))
                    .map_err(|_| AppError::Internal)?,
            );
            res.headers_mut().insert(
                header::ETAG,
                HeaderValue::from_str(&etag).map_err(|_| AppError::Internal)?,
            );
            res.headers_mut().insert(
                header::LAST_MODIFIED,
                HeaderValue::from_str(&last_modified).map_err(|_| AppError::Internal)?,
            );
            res.headers_mut()
                .insert(header::ACCEPT_RANGES, HeaderValue::from_static("bytes"));
            return Ok(res);
        }

        if ranges.len() > 1 {
            // 多段 Range：multipart/byteranges
            use async_stream::try_stream;
            use tokio_stream::StreamExt;

            let boundary = format!("BOUNDARY-{}", Uuid::new_v4());
            let mime_type = file.mime_type.clone();
            let file_path = file.file_path.clone();
            let storage = file_service;
            let original_filename = file.original_filename.clone();

            let stream = try_stream! {
                for (start, end) in ranges {
                    let header_bytes = format!(
                        "--{b}\r\nContent-Type: {mime}\r\nContent-Range: bytes {start}-{end}/{total}\r\n\r\n",
                        b = boundary,
                        mime = mime_type,
                        total = total_size
                    );
                    yield Bytes::from(header_bytes);

                    let part_stream = storage.open_file_stream_range(&crate::models::file::File {
                        id: file.id,
                        user_id: file.user_id,
                        filename: file.filename.clone(),
                        original_filename: original_filename.clone(),
                        file_path: file_path.clone(),
                        file_size: file.file_size,
                        mime_type: mime_type.clone(),
                        storage_backend: file.storage_backend.clone(),
                        category: file.category.clone(),
                        folder_id: file.folder_id,
                        created_at: file.created_at,
                        updated_at: file.updated_at,
                    }, start, end).await?;

                    match part_stream {
                        StorageReadStream::Local(mut f) => {
                            f.seek(std::io::SeekFrom::Start(start)).await?;
                            let reader = f.take(end - start + 1);
                            let mut rs = ReaderStream::new(reader);
                            while let Some(chunk) = rs.next().await {
                                let chunk = chunk?;
                                yield chunk;
                            }
                        }
                        StorageReadStream::S3(s) => {
                            let reader = s.into_async_read();
                            let mut rs = ReaderStream::new(reader);
                            while let Some(chunk) = rs.next().await {
                                let chunk = chunk?;
                                yield chunk;
                            }
                        }
                    }

                    yield Bytes::from_static(b"\r\n");
                }
                yield Bytes::from(format!("--{}--\r\n", boundary));
            };

            let body = Body::from_stream(stream);
            let mut res = stream_file_response(
                body,
                &file.original_filename,
                &file.mime_type,
                inline,
                None,
            )
            .map_err(|_| AppError::Internal)?;
            *res.status_mut() = StatusCode::PARTIAL_CONTENT;
            res.headers_mut().insert(
                header::CONTENT_TYPE,
                HeaderValue::from_str(&format!("multipart/byteranges; boundary={}", boundary))
                    .map_err(|_| AppError::Internal)?,
            );
            res.headers_mut().insert(
                header::ETAG,
                HeaderValue::from_str(&etag).map_err(|_| AppError::Internal)?,
            );
            res.headers_mut().insert(
                header::LAST_MODIFIED,
                HeaderValue::from_str(&last_modified).map_err(|_| AppError::Internal)?,
            );
            res.headers_mut().insert(
                header::CACHE_CONTROL,
                HeaderValue::from_static("private, max-age=0, must-revalidate"),
            );
            res.headers_mut()
                .insert(header::ACCEPT_RANGES, HeaderValue::from_static("bytes"));
            res.headers_mut().insert(
                header::VARY,
                HeaderValue::from_static("Range"),
            );
            return Ok(res);
        }

        let (start, end_raw) = ranges[0];
        if start >= total_size || start > end_raw {
            let mut res = StatusCode::RANGE_NOT_SATISFIABLE.into_response();
            res.headers_mut().insert(
                header::CONTENT_RANGE,
                HeaderValue::from_str(&format!("bytes */{}", total_size))
                    .map_err(|_| AppError::Internal)?,
            );
            res.headers_mut().insert(
                header::ETAG,
                HeaderValue::from_str(&etag).map_err(|_| AppError::Internal)?,
            );
            res.headers_mut().insert(
                header::LAST_MODIFIED,
                HeaderValue::from_str(&last_modified).map_err(|_| AppError::Internal)?,
            );
            res.headers_mut()
                .insert(header::ACCEPT_RANGES, HeaderValue::from_static("bytes"));
            return Ok(res);
        }

        let end = end_raw.min(total_size.saturating_sub(1));
        let len = end - start + 1;

        let stream = file_service.open_file_stream_range(&file, start, end).await?;
        let body = match stream {
            StorageReadStream::Local(mut f) => {
                f.seek(std::io::SeekFrom::Start(start))
                    .await
                    .map_err(|e| AppError::File(format!("Failed to seek file: {}", e)))?;
                let reader = f.take(len);
                Body::from_stream(ReaderStream::new(reader))
            }
            StorageReadStream::S3(s) => {
                let reader = s.into_async_read();
                Body::from_stream(ReaderStream::new(reader))
            }
        };

        let mut res = stream_file_response(
            body,
            &file.original_filename,
            &file.mime_type,
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
        res.headers_mut().insert(
            header::ETAG,
            HeaderValue::from_str(&etag).map_err(|_| AppError::Internal)?,
        );
        res.headers_mut().insert(
            header::LAST_MODIFIED,
            HeaderValue::from_str(&last_modified).map_err(|_| AppError::Internal)?,
        );
        res.headers_mut().insert(
            header::CACHE_CONTROL,
            HeaderValue::from_static("private, max-age=0, must-revalidate"),
        );
        res.headers_mut()
            .insert(header::ACCEPT_RANGES, HeaderValue::from_static("bytes"));
        res.headers_mut().insert(
            header::VARY,
            HeaderValue::from_static("Range"),
        );
        return Ok(res);
    }

    let stream = file_service.open_file_stream(&file).await?;
    let body = match stream {
        StorageReadStream::Local(f) => Body::from_stream(ReaderStream::new(f)),
        StorageReadStream::S3(s) => {
            let reader = s.into_async_read();
            Body::from_stream(ReaderStream::new(reader))
        }
    };

    let mut res = stream_file_response(
        body,
        &file.original_filename,
        &file.mime_type,
        inline,
        Some(total_size),
    )
    .map_err(|_| AppError::Internal)?;
    res.headers_mut().insert(
        header::ETAG,
        HeaderValue::from_str(&etag).map_err(|_| AppError::Internal)?,
    );
    res.headers_mut().insert(
        header::LAST_MODIFIED,
        HeaderValue::from_str(&last_modified).map_err(|_| AppError::Internal)?,
    );
    res.headers_mut().insert(
        header::CACHE_CONTROL,
        HeaderValue::from_static("private, max-age=0, must-revalidate"),
    );
    res.headers_mut()
        .insert(header::ACCEPT_RANGES, HeaderValue::from_static("bytes"));
    res.headers_mut().insert(
        header::VARY,
        HeaderValue::from_static("Range"),
    );
    Ok(res)
}

/// 上传文件（普通上传）
///
/// 处理 multipart/form-data 格式的文件上传请求。
///
/// # 请求格式
/// - Content-Type: `multipart/form-data`
/// - Field name: `file`
///
/// # 响应
/// ```json
/// {
///   "file": {
///     "id": "...",
///     "filename": "...",
///     ...
///   }
/// }
/// ```
pub async fn upload_file_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
    mut multipart: Multipart,
) -> Result<Response, AppError> {
    use tokio::io::AsyncWriteExt;

    let file_service = FileService::from_state(&state);

    // 解析 multipart 表单：以流式方式写入临时文件，避免把整个文件载入内存
    let mut file_meta: Option<(String, String, u64, std::path::PathBuf)> = None;

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| AppError::File(format!("Failed to parse multipart: {}", e)))?
    {
        let name = field.name().unwrap_or("").to_string();

        if name == "file" {
            let filename = field
                .file_name()
                .ok_or_else(|| AppError::File("Missing filename".to_string()))?
                .to_string();

            let mime_type = field
                .content_type()
                .map(|s| s.to_string())
                .unwrap_or_else(|| "application/octet-stream".to_string());

            // 临时文件路径
            let tmp_dir = std::env::temp_dir().join("file-storage-backend");
            tokio::fs::create_dir_all(&tmp_dir)
                .await
                .map_err(|e| AppError::Storage(format!("Failed to create temp dir: {}", e)))?;
            let tmp_path = tmp_dir.join(format!("upload_{}", Uuid::new_v4()));

            // 磁盘空间保护（best-effort）：至少保证能容纳 max_file_size 的一小部分，否则直接拒绝
            // 注：更严格的策略会在写入过程中不断检查，但这里先做轻量保护 + 过程熔断
            if let Ok(free) = fs2::available_space(&tmp_dir) {
                // 预留 16MiB 作为安全边界（日志/临时文件/元数据）
                let reserve = 16 * 1024 * 1024u64;
                if free.saturating_sub(reserve) == 0 {
                    return Err(AppError::Storage("磁盘空间不足，请稍后重试".to_string()));
                }
            }

            let mut out = tokio::fs::File::create(&tmp_path)
                .await
                .map_err(|e| AppError::Storage(format!("Failed to create temp file: {}", e)))?;

            // 流式写入并统计大小
            let mut file_size: u64 = 0;
            let mut field = field;
            while let Some(chunk) = field
                .chunk()
                .await
                .map_err(|e| AppError::File(format!("Failed to read upload chunk: {}", e)))?
            {
                file_size = file_size.saturating_add(chunk.len() as u64);

                // 早期熔断：超过配置最大值立刻停止（避免继续读入/写盘）
                if file_size > state.config.max_file_size {
                    let _ = tokio::fs::remove_file(&tmp_path).await;
                    return Err(AppError::PayloadTooLarge(format!(
                        "文件大小超过限制（{} bytes）",
                        state.config.max_file_size
                    )));
                }

                out.write_all(&chunk)
                    .await
                    .map_err(|e| AppError::Storage(format!("Failed to write temp file: {}", e)))?;
            }
            out.flush()
                .await
                .map_err(|e| AppError::Storage(format!("Failed to flush temp file: {}", e)))?;

            file_meta = Some((filename, mime_type, file_size, tmp_path));
            break;
        }
    }

    let (original_filename, mime_type, file_size, tmp_path) =
        file_meta.ok_or_else(|| AppError::File("No file provided".to_string()))?;

    // 创建文件（优先走 from-path，避免大文件占用内存）
    let file = match file_service
        .create_file_from_path(user_id, original_filename, mime_type, file_size, &tmp_path)
        .await
    {
        Ok(file) => file,
        Err(e) => {
            let _ = tokio::fs::remove_file(&tmp_path).await;
            return Err(e);
        }
    };

    Ok(json_response(json!({ "file": file })))
}

/// 获取文件列表
///
/// 支持分页、搜索、过滤等功能。
///
/// # 查询参数
/// - `page`: 页码（默认: 1）
/// - `limit`: 每页数量（默认: 20，最大: 100）
/// - `search`: 搜索关键词（文件名）
/// - `mime_type`: MIME 类型过滤
/// - `category`: 分类过滤
/// - `date_from`, `date_to`: 日期范围
/// - `size_min`, `size_max`: 文件大小范围
///
/// # 响应
/// ```json
/// {
///   "files": [...],
///   "total": 100,
///   "page": 1,
///   "limit": 20
/// }
/// ```
///
/// 与 skill 规范及前端 `FileListResponse` 一致，使用 `files` 字段。
pub async fn list_files_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
    Query(query): Query<FileListQuery>,
) -> Result<Response, AppError> {
    let file_service = FileService::from_state(&state);

    // 提取分页参数（在移动 query 之前）
    let page = query.page.unwrap_or(1);
    let limit = query.limit.unwrap_or(20);

    let (files, total) = file_service.list_files(user_id, query).await?;

    Ok(json_response(json!({
        "files": files,
        "total": total,
        "page": page,
        "limit": limit,
    })))
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

/// 删除文件
pub async fn delete_file_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
    Path(file_id): Path<Uuid>,
) -> Result<Response, AppError> {
    let file_service = FileService::from_state(&state);
    file_service.delete_file(file_id, user_id).await?;
    Ok(success_response("File deleted successfully"))
}

/// 批量删除文件
///
/// # 请求体
/// ```json
/// {
///   "ids": ["uuid1", "uuid2", ...]
/// }
/// ```
pub async fn batch_delete_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
    axum::Json(req): axum::Json<BatchDeleteRequest>,
) -> Result<Response, AppError> {
    let file_service = FileService::from_state(&state);
    let deleted = file_service.batch_delete(&req.ids, user_id).await?;
    Ok(json_response(json!({
        "deleted": deleted,
        "message": "Batch delete completed"
    })))
}

/// 批量下载文件（ZIP 格式）
///
/// # 查询参数
/// - `ids`: 逗号分隔的文件 ID 列表
pub async fn batch_download_zip_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Response, AppError> {
    let file_service = FileService::from_state(&state);

    // 解析文件 ID 列表
    let ids_str = params
        .get("ids")
        .ok_or_else(|| AppError::Validation("Missing ids parameter".to_string()))?;
    let ids = parse_uuid_list(ids_str)?;

    // 生成 ZIP 文件
    let zip_data = file_service.batch_download_zip(&ids, user_id).await?;

    // 返回 ZIP 文件响应
    file_response(zip_data, "files.zip", "application/zip", false)
        .map_err(|_| AppError::Internal)
}

/// 批量下载文件（ZIP 格式）- POST 版本
///
/// 避免 GET 查询参数过长（文件过多时 URL 可能超限）。
///
/// # 请求体
/// ```json
/// { "ids": ["uuid1", "uuid2", "..."] }
/// ```
pub async fn batch_download_zip_post_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
    axum::Json(req): axum::Json<BatchDeleteRequest>,
) -> Result<Response, AppError> {
    let file_service = FileService::from_state(&state);

    // 生成 ZIP 文件
    let zip_data = file_service.batch_download_zip(&req.ids, user_id).await?;

    // 返回 ZIP 文件响应
    file_response(zip_data, "files.zip", "application/zip", false)
        .map_err(|_| AppError::Internal)
}

/// 获取存储使用情况
///
/// 返回用户的存储使用量和配额信息。
pub async fn storage_usage_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
) -> Result<Response, AppError> {
    let file_service = FileService::from_state(&state);

    let (total_size, file_count) = file_service.get_storage_usage(user_id).await?;
    let quota = file_service.get_storage_quota(user_id).await?;

    // 计算配额信息（MB）
    let quota_mb = quota.map(|q| (q as f64 / 1_048_576.0).round() as i64);
    let usage_percent = quota.map(|q| {
        if q > 0 {
            ((total_size as f64 / q as f64) * 100.0).round() as i32
        } else {
            0
        }
    });

    Ok(json_response(json!({
        "total_size": total_size,
        "file_count": file_count,
        "total_size_mb": (total_size as f64 / 1_048_576.0).round() as i64,
        "quota": quota,
        "quota_mb": quota_mb,
        "usage_percent": usage_percent,
        "is_unlimited": quota.is_none(),
    })))
}

/// 获取文件分类列表
///
/// 返回用户所有文件的分类列表（去重）。
pub async fn categories_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
) -> Result<Response, AppError> {
    let file_service = FileService::from_state(&state);
    let categories = file_service.list_categories(user_id).await?;
    Ok(json_response(json!({ "categories": categories })))
}

/// 批量移动文件到分类
///
/// # 请求体
/// ```json
/// {
///   "ids": ["uuid1", "uuid2", ...],
///   "category": "新分类"  // 空字符串或 null 表示取消分类
/// }
/// ```
pub async fn batch_move_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
    axum::Json(req): axum::Json<BatchMoveRequest>,
) -> Result<Response, AppError> {
    let file_service = FileService::from_state(&state);
    let moved = file_service.batch_move(user_id, req).await?;
    Ok(json_response(json!({
        "moved": moved,
        "message": "Batch move completed"
    })))
}

// ============================================================================
// 分块上传（可恢复上传）Handlers
// ============================================================================

/// 初始化分块上传会话
///
/// 创建上传会话，返回上传 ID、分块大小和总分块数。
///
/// # 请求体
/// ```json
/// {
///   "filename": "large-file.zip",
///   "mime_type": "application/zip",
///   "total_size": 104857600
/// }
/// ```
pub async fn chunked_upload_init_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
    axum::Json(req): axum::Json<InitChunkedUploadRequest>,
) -> Result<Response, AppError> {
    let file_service = FileService::from_state(&state);
    let (upload_id, chunk_size, total_parts) =
        file_service.init_chunked_upload(user_id, req).await?;
    Ok(json_response(json!({
        "upload_id": upload_id,
        "chunk_size": chunk_size,
        "total_parts": total_parts,
    })))
}

/// 上传分块
///
/// # 路径参数
/// - `upload_id`: 上传会话 ID
///
/// # 查询参数
/// - `part`: 分块索引（从 1 开始）
///
/// # 请求体
/// 分块的二进制数据
pub async fn chunked_upload_chunk_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
    Path(upload_id): Path<Uuid>,
    Query(params): Query<HashMap<String, String>>,
    body: Bytes,
) -> Result<Response, AppError> {
    let file_service = FileService::from_state(&state);

    // 解析分块索引
    let part = parse_part_number(&params)?;

    // 上传分块
    file_service
        .upload_chunk(upload_id, user_id, part, body)
        .await?;

    Ok(json_response(json!({ "ok": true, "part": part })))
}

/// 查询分块上传状态
///
/// 返回已上传的分块列表和总分块数，用于断点续传。
pub async fn chunked_upload_status_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
    Path(upload_id): Path<Uuid>,
) -> Result<Response, AppError> {
    let file_service = FileService::from_state(&state);
    let (uploaded_parts, total_parts) = file_service
        .chunked_upload_status(upload_id, user_id)
        .await?;
    Ok(json_response(json!({
        "upload_id": upload_id,
        "uploaded_parts": uploaded_parts,
        "total_parts": total_parts,
    })))
}

/// 完成分块上传
///
/// 合并所有分块，创建文件记录，清理临时文件。
pub async fn chunked_upload_complete_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
    Path(upload_id): Path<Uuid>,
    axum::Json(req): axum::Json<CompleteChunkedUploadRequest>,
) -> Result<Response, AppError> {
    let file_service = FileService::from_state(&state);
    let file = file_service
        .complete_chunked_upload(upload_id, user_id, req)
        .await?;
    Ok(json_response(json!({ "file": file })))
}

/// 取消分块上传
///
/// 删除上传会话和所有临时文件。
pub async fn chunked_upload_abort_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
    Path(upload_id): Path<Uuid>,
) -> Result<Response, AppError> {
    let file_service = FileService::from_state(&state);
    file_service
        .abort_chunked_upload(upload_id, user_id)
        .await?;
    Ok(success_response("Upload aborted"))
}
