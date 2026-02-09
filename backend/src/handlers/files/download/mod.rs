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

use axum::extract::{Path, Query, State};
use axum::http::{header, HeaderMap, Method};
use axum::response::Response;
use uuid::Uuid;

use crate::extractors::{AuthenticatedUser, AuthenticatedUserQuery};
use crate::utils::response::file_response;
use crate::utils::thumbnail::generate_thumbnail_jpeg;
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

    let file = state.file_service.get_file(file_id, user_id).await?;

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
    // 但在返回 304 之前，先验证文件是否真实存在且非空
    if range_header.is_none() && if_none_match == Some(entity_headers.etag_str.as_str()) {
        // 验证文件是否存在，防止数据库记录存在但文件缺失的情况
        if state.file_service.verify_file_exists(&file).await.is_ok() {
            return Ok(not_modified_response(&entity_headers));
        }
        // 文件不存在，继续处理以返回错误或重新生成内容
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
                    // 同样验证文件是否存在
                    if state.file_service.verify_file_exists(&file).await.is_ok() {
                        return Ok(not_modified_response(&entity_headers));
                    }
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
    AuthenticatedUserQuery(user_id): AuthenticatedUserQuery,
    method: Method,
    headers: HeaderMap,
    Path(file_id): Path<Uuid>,
) -> Result<Response, AppError> {
    file_get_or_head_response(&state, user_id, method, headers, file_id, true).await
}

/// 缩略图查询参数：最大边长（像素），默认 400，范围 64..=800
#[derive(serde::Deserialize)]
pub struct ThumbnailQuery {
    #[serde(default = "default_thumb_size")]
    pub w: u32,
}

fn default_thumb_size() -> u32 {
    400
}

/// 图片缩略图（方案 B：先读盘，无则生成并写盘；GIF 只解第一帧；Ugoira 取首帧）
///
/// 支持 `image/*` 与 Ugoira（`application/x-ugoira` 或 `application/zip` + `.ugoira`），返回 JPEG 缩略图。
pub async fn thumbnail_file_handler(
    State(state): State<AppState>,
    AuthenticatedUserQuery(user_id): AuthenticatedUserQuery,
    Path(file_id): Path<Uuid>,
    Query(q): Query<ThumbnailQuery>,
) -> Result<Response, AppError> {
    let file = state.file_service.get_file(file_id, user_id).await?;

    let fname = file.original_filename.to_lowercase();
    let is_ugoira = fname.ends_with(".ugoira");
    let is_supported = file.mime_type.starts_with("image/")
        || file.mime_type == "application/x-ugoira"
        || ((file.mime_type == "application/zip" || file.mime_type == "application/octet-stream")
            && is_ugoira);
    if !is_supported {
        return Err(AppError::NotFound);
    }

    let w = q.w.clamp(64, 800);

    // 方案 B：先读已存在的缩略图（按用户隔离）
    if let Ok(cached) = state.file_service.get_thumbnail(file_id, user_id).await {
        return file_response(cached, "thumb.jpg", "image/jpeg", true)
            .map_err(|_| AppError::Internal);
    }

    // 无缓存：在阻塞线程中生成缩略图，避免长时间占用 async 工作线程导致超时或无法正确返回
    let data = state.file_service.get_file_data(&file).await?;
    let mime_type = file.mime_type.clone();
    let buf = tokio::task::spawn_blocking(move || generate_thumbnail_jpeg(data, mime_type, w))
        .await
        .map_err(|_| AppError::Internal)?;
    let buf = match buf {
        Ok(b) => b,
        Err(AppError::File(e)) => {
            tracing::debug!(file_id = %file_id, error = %e, "缩略图生成失败，返回 404");
            return Err(AppError::NotFound);
        }
        Err(e) => return Err(e),
    };

    if let Err(e) = state.file_service.save_thumbnail(file_id, user_id, &buf).await {
        tracing::warn!(file_id = %file_id, error = %e, "缩略图生成成功但保存失败，下次请求将重新生成");
    }

    file_response(buf, "thumb.jpg", "image/jpeg", true)
        .map_err(|_| AppError::Internal)
}

/// 返回 HLS 主列表（playlist.m3u8），供前端 hls.js 加载。仅对超过阈值的视频生效。
/// 将 m3u8 内的 segment*.ts 引用重写为 hls/segment*.ts，使相对 URL 解析到 /api/files/:id/hls/segment*.ts。
pub async fn hls_playlist_handler(
    State(state): State<AppState>,
    AuthenticatedUserQuery(user_id): AuthenticatedUserQuery,
    Path(file_id): Path<Uuid>,
) -> Result<Response, AppError> {
    let file = state.file_service.get_file(file_id, user_id).await?;
    let out_dir = state.file_service.ensure_hls_ready(&file).await?;
    let playlist_path = out_dir.join("playlist.m3u8");
    let data = tokio::fs::read(&playlist_path)
        .await
        .map_err(|e| AppError::File(format!("读取 HLS 列表失败: {}", e)))?;
    // 重写 segment 引用：segment000.ts -> hls/segment000.ts，使相对 base .../hls 解析到 .../hls/segment000.ts
    let rewritten = rewrite_hls_segment_refs(&data);
    crate::utils::response::file_response(
        rewritten,
        "playlist.m3u8",
        "application/vnd.apple.mpegurl",
        true,
    )
    .map_err(|_| AppError::Internal)
}

/// 将 m3u8 内容中的 segment*.ts 行改为 hls/segment*.ts，供相对 URL 正确解析。
fn rewrite_hls_segment_refs(data: &[u8]) -> Vec<u8> {
    use std::io::{BufRead, BufReader, Write};
    let mut out = Vec::with_capacity(data.len() + 64);
    for line in BufReader::new(data).lines().flatten() {
        let trimmed = line.trim();
        if !trimmed.is_empty()
            && !trimmed.starts_with('#')
            && trimmed.ends_with(".ts")
            && trimmed.chars().all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '_')
        {
            let _ = write!(out, "hls/{}\n", trimmed);
        } else {
            let _ = writeln!(out, "{}", line);
        }
    }
    out
}

/// 返回 HLS 分片（segment*.ts）或 playlist.m3u8。仅允许安全文件名，防止路径穿越。
pub async fn hls_asset_handler(
    State(state): State<AppState>,
    AuthenticatedUserQuery(user_id): AuthenticatedUserQuery,
    Path((file_id, filename)): Path<(Uuid, String)>,
) -> Result<Response, AppError> {
    let file = state.file_service.get_file(file_id, user_id).await?;
    if !state.file_service.should_use_hls(&file) {
        return Err(AppError::NotFound);
    }
    let out_dir = state.file_service.ensure_hls_ready(&file).await?;
    let safe_name = filename
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '_')
        && (filename.ends_with(".ts") || filename.ends_with(".m3u8"))
        && !filename.contains("..");
    if !safe_name {
        return Err(AppError::Validation("无效的 HLS 资源名".to_string()));
    }
    let path = out_dir.join(&filename);
    let parent = path.parent().ok_or_else(|| AppError::Validation("无效的 HLS 资源名".to_string()))?;
    if parent != out_dir.as_path() {
        return Err(AppError::Validation("无效的 HLS 资源名".to_string()));
    }
    let data = tokio::fs::read(&path)
        .await
        .map_err(|_| AppError::NotFound)?;
    let mime = if filename.ends_with(".m3u8") {
        "application/vnd.apple.mpegurl"
    } else {
        "video/MP2T"
    };
    crate::utils::response::file_response(data, &filename, mime, true)
        .map_err(|_| AppError::Internal)
}
