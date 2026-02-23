//! 批量操作
//!
//! - 批量删除
//! - 批量按 ID 查详情
//! - 批量移动到分类
//! - 批量打包下载（ZIP，流式边打包边传输）

use axum::body::Body;
use axum::extract::{Query, State};
use axum::http::{header, HeaderMap, HeaderValue, StatusCode};
use axum::response::Response;
use bytes::Bytes;
use serde_json::json;
use std::collections::HashMap;
use std::sync::mpsc;
use std::sync::{Arc, Mutex};
use uuid::Uuid;

use crate::extractors::AuthenticatedUser;
use crate::models::file::{BatchDeleteRequest, BatchGetRequest, BatchMoveRequest};
use crate::services::file::{run_zip_writer_thread, write_zip_to_file};
use crate::utils::{file_response, json_response, parse_uuid_list, stream_file_response, AppError};
use crate::AppState;

/// 批量按 ID 查询文件元数据
///
/// 返回顺序与请求 ids 一致；未找到或无权访问的项为 null。
/// 供前端批量请求合并（BatchRequestManager）使用。
///
/// # 请求体
/// ```json
/// { "ids": ["uuid1", "uuid2", ...] }
/// ```
pub async fn batch_get_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
    axum::Json(req): axum::Json<BatchGetRequest>,
) -> Result<Response, AppError> {
    let files = state
        .file_service
        .get_files_by_ids(user_id, &req.ids)
        .await?;
    Ok(json_response(json!({ "files": files })))
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
    let deleted = state.file_service.batch_delete(&req.ids, user_id).await?;
    if deleted > 0 {
        if let Some(pool) = &state.redis {
            let _ = crate::services::redis::RedisService::new(pool.clone())
                .bump_user_cache_version(user_id)
                .await;
        }
    }
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
    // 解析文件 ID 列表
    let ids_str = params
        .get("ids")
        .ok_or_else(|| AppError::Validation("Missing ids parameter".to_string()))?;
    let ids = parse_uuid_list(ids_str)?;

    // 生成 ZIP 文件
    let zip_data = state.file_service.batch_download_zip(&ids, user_id).await?;

    // 返回 ZIP 文件响应
    file_response(zip_data, "files.zip", "application/zip", false).map_err(|_| AppError::Internal)
}

/// 批量下载文件（ZIP 格式）- POST 版本，流式边打包边传输
///
/// 避免 GET 查询参数过长；响应体边打包边发送，不整包进内存，首字节更快、大包更稳。
///
/// # 请求体
/// ```json
/// { "ids": ["uuid1", "uuid2", "..."] }
/// ```
pub async fn batch_download_zip_post_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
    headers: HeaderMap,
    axum::Json(req): axum::Json<BatchDeleteRequest>,
) -> Result<Response, AppError> {
    let entries = state
        .file_service
        .prepare_batch_zip_entries(&req.ids, user_id)
        .await?;

    if let Some(range) = headers.get(header::RANGE).and_then(|v| v.to_str().ok()) {
        use tokio::io::{AsyncReadExt, AsyncSeekExt};
        use tokio_util::io::ReaderStream;

        let tmp_path = std::env::temp_dir().join(format!("files-{}.zip", Uuid::new_v4()));

        let (input_tx, input_rx) = mpsc::channel();

        let file_service = state.file_service.clone();
        tokio::spawn(async move {
            for (file, name) in entries {
                if let Ok(data) = file_service.get_file_data(&file).await {
                    let _ = input_tx.send((Some(name), data));
                }
            }
            let _ = input_tx.send((None, vec![]));
        });

        let tmp_path_for_write = tmp_path.clone();
        let total_size = tokio::task::spawn_blocking(move || -> Result<u64, AppError> {
            let f = std::fs::File::create(&tmp_path_for_write)
                .map_err(|e| AppError::File(format!("Failed to create zip file: {}", e)))?;
            let size = write_zip_to_file(input_rx, f)
                .map_err(|e| AppError::File(format!("Failed to write zip file: {}", e)))?;
            Ok(size)
        })
        .await
        .map_err(|_| AppError::Internal)??;

        let (start, end) = match parse_single_range(range, total_size) {
            Ok(v) => v,
            Err(_) => {
                let mut res = Response::builder()
                    .status(StatusCode::RANGE_NOT_SATISFIABLE)
                    .body(Body::empty())
                    .map_err(|_| AppError::Internal)?;
                res.headers_mut().insert(
                    header::CONTENT_RANGE,
                    HeaderValue::from_str(&format!("bytes */{}", total_size))
                        .map_err(|_| AppError::Internal)?,
                );
                return Ok(res);
            }
        };

        let len = end - start + 1;
        let mut f = tokio::fs::File::open(&tmp_path)
            .await
            .map_err(|e| AppError::File(format!("Failed to open zip file: {}", e)))?;
        let _ = tokio::fs::remove_file(&tmp_path).await;

        f.seek(std::io::SeekFrom::Start(start))
            .await
            .map_err(|e| AppError::File(format!("Failed to seek zip file: {}", e)))?;
        let reader = f.take(len);
        let body = Body::from_stream(ReaderStream::new(reader));

        let mut res = stream_file_response(body, "files.zip", "application/zip", false, Some(len))
            .map_err(|_| AppError::Internal)?;
        *res.status_mut() = StatusCode::PARTIAL_CONTENT;
        res.headers_mut().insert(
            header::CONTENT_RANGE,
            HeaderValue::from_str(&format!("bytes {}-{}/{}", start, end, total_size))
                .map_err(|_| AppError::Internal)?,
        );
        res.headers_mut().insert(
            header::ACCEPT_RANGES,
            HeaderValue::from_static("bytes"),
        );
        return Ok(res);
    }

    let (input_tx, input_rx) = mpsc::channel();
    let (output_tx, output_rx) = mpsc::sync_channel::<Vec<u8>>(32);

    std::thread::spawn(move || run_zip_writer_thread(input_rx, output_tx));

    let file_service = state.file_service.clone();
    tokio::spawn(async move {
        for (file, name) in entries {
            if let Ok(data) = file_service.get_file_data(&file).await {
                let _ = input_tx.send((Some(name), data));
            }
        }
        let _ = input_tx.send((None, vec![]));
    });

    let output_rx = Arc::new(Mutex::new(output_rx));
    let stream = async_stream::stream! {
        loop {
            let rx = Arc::clone(&output_rx);
            let chunk = tokio::task::spawn_blocking(move || {
                rx.lock().ok().and_then(|guard| guard.recv().ok())
            })
                .await
                .ok()
                .flatten();
            match chunk {
                Some(c) => yield Ok::<_, std::io::Error>(Bytes::from(c)),
                None => break,
            }
        }
    };

    stream_file_response(
        Body::from_stream(stream),
        "files.zip",
        "application/zip",
        false,
        None,
    )
    .map_err(|_| AppError::Internal)
}

fn parse_single_range(range: &str, total_size: u64) -> Result<(u64, u64), AppError> {
    if total_size == 0 {
        return Err(AppError::Validation("空文件不支持 Range".to_string()));
    }

    let Some(rest) = range.strip_prefix("bytes=") else {
        return Err(AppError::Validation("无效的 Range".to_string()));
    };

    if rest.contains(',') {
        return Err(AppError::Validation("暂不支持多段 Range".to_string()));
    }

    let part = rest.trim();
    let Some((a, b)) = part.split_once('-') else {
        return Err(AppError::Validation("无效的 Range".to_string()));
    };

    let a = a.trim();
    let b = b.trim();

    let (start, mut end) = if a.is_empty() {
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
        return Err(AppError::Validation("Range 不可满足".to_string()));
    }

    end = end.min(total_size - 1);
    if start > end {
        return Err(AppError::Validation("Range 不可满足".to_string()));
    }

    Ok((start, end))
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
    let moved = state.file_service.batch_move(user_id, req).await?;
    if moved > 0 {
        if let Some(pool) = &state.redis {
            let _ = crate::services::redis::RedisService::new(pool.clone())
                .bump_user_cache_version(user_id)
                .await;
        }
    }
    Ok(json_response(json!({
        "moved": moved,
        "message": "Batch move completed"
    })))
}
