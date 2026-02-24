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
use deadpool_redis::redis::cmd;
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
    if state.config.cache_enabled {
        if let Some(pool) = &state.redis {
            use crate::models::file::FileResponse;

            let redis = crate::services::redis::RedisService::new(pool.clone());
            let ver = redis.get_user_cache_version(user_id).await.unwrap_or(1);

            let keys: Vec<String> = req
                .ids
                .iter()
                .map(|id| format!("cache:files:meta:{}:{}:{}", user_id, ver, id))
                .collect();

            let mut cached_by_id: std::collections::HashMap<Uuid, FileResponse> =
                std::collections::HashMap::new();

            if let Ok(mut conn) = pool.get().await {
                let cached: Result<Vec<Option<String>>, _> =
                    cmd("MGET").arg(keys.clone()).query_async(&mut conn).await;
                if let Ok(values) = cached {
                    for (idx, v) in values.into_iter().enumerate() {
                        let Some(s) = v else { continue };
                        if let Ok(file) = serde_json::from_str::<FileResponse>(&s) {
                            cached_by_id.insert(req.ids[idx], file);
                        }
                    }
                }
            }

            let mut miss_ids: Vec<Uuid> = Vec::new();
            for id in &req.ids {
                if !cached_by_id.contains_key(id) {
                    miss_ids.push(*id);
                }
            }

            if !miss_ids.is_empty() {
                let fetched = state
                    .file_service
                    .get_files_by_ids(user_id, &miss_ids)
                    .await?;

                if let Ok(mut conn) = pool.get().await {
                    for (id, item) in miss_ids.iter().zip(fetched.iter()) {
                        let Some(file) = item else { continue };
                        if let Ok(body) = serde_json::to_string(file) {
                            let cache_key = format!("cache:files:meta:{}:{}:{}", user_id, ver, id);
                            let _: Result<(), _> = cmd("SETEX")
                                .arg(cache_key)
                                .arg(state.config.cache_default_ttl_secs)
                                .arg(body)
                                .query_async(&mut conn)
                                .await;
                        }
                    }
                }

                for (id, item) in miss_ids.into_iter().zip(fetched.into_iter()) {
                    if let Some(file) = item {
                        cached_by_id.insert(id, file);
                    }
                }
            }

            let ordered: Vec<Option<FileResponse>> = req
                .ids
                .iter()
                .map(|id| cached_by_id.get(id).cloned())
                .collect();

            return Ok(json_response(json!({ "files": ordered })));
        }
    }

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

    let _permit = state
        .zip_build_semaphore
        .clone()
        .acquire_owned()
        .await
        .map_err(|_| AppError::Internal)?;

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

    if state.config.zip_cache_enabled {
        use tokio::io::{AsyncReadExt, AsyncSeekExt};
        use tokio_util::io::ReaderStream;

        let zip_build_permit = state
            .zip_build_semaphore
            .clone()
            .acquire_owned()
            .await
            .map_err(|_| AppError::Internal)?;
        let artifact = state
            .file_service
            .clone()
            .get_or_create_cached_batch_zip(entries, user_id, Some(zip_build_permit))
            .await?;

        if let Some(range) = headers.get(header::RANGE).and_then(|v| v.to_str().ok()) {
            let (start, end) = match parse_single_range(range, artifact.size) {
                Ok(v) => v,
                Err(_) => {
                    let mut res = Response::builder()
                        .status(StatusCode::RANGE_NOT_SATISFIABLE)
                        .body(Body::empty())
                        .map_err(|_| AppError::Internal)?;
                    res.headers_mut().insert(
                        header::CONTENT_RANGE,
                        HeaderValue::from_str(&format!("bytes */{}", artifact.size))
                            .map_err(|_| AppError::Internal)?,
                    );
                    return Ok(res);
                }
            };

            let len = end - start + 1;
            let mut f = tokio::fs::File::open(&artifact.path)
                .await
                .map_err(|e| AppError::File(format!("Failed to open zip file: {}", e)))?;

            f.seek(std::io::SeekFrom::Start(start))
                .await
                .map_err(|e| AppError::File(format!("Failed to seek zip file: {}", e)))?;
            let reader = f.take(len);
            let body = Body::from_stream(ReaderStream::new(reader));

            let mut res =
                stream_file_response(body, "files.zip", "application/zip", false, Some(len))
                    .map_err(|_| AppError::Internal)?;
            *res.status_mut() = StatusCode::PARTIAL_CONTENT;
            res.headers_mut().insert(
                header::CONTENT_RANGE,
                HeaderValue::from_str(&format!("bytes {}-{}/{}", start, end, artifact.size))
                    .map_err(|_| AppError::Internal)?,
            );
            res.headers_mut()
                .insert(header::ACCEPT_RANGES, HeaderValue::from_static("bytes"));
            return Ok(res);
        }

        let f = tokio::fs::File::open(&artifact.path)
            .await
            .map_err(|e| AppError::File(format!("Failed to open zip file: {}", e)))?;
        let body = Body::from_stream(ReaderStream::new(f));
        return stream_file_response(
            body,
            "files.zip",
            "application/zip",
            false,
            Some(artifact.size),
        )
        .map_err(|_| AppError::Internal);
    }

    if let Some(range) = headers.get(header::RANGE).and_then(|v| v.to_str().ok()) {
        use tokio::io::{AsyncReadExt, AsyncSeekExt};
        use tokio_util::io::ReaderStream;

        let zip_build_permit = state
            .zip_build_semaphore
            .clone()
            .acquire_owned()
            .await
            .map_err(|_| AppError::Internal)?;
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
            let _permit = zip_build_permit;
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

    let zip_build_permit = state
        .zip_build_semaphore
        .clone()
        .acquire_owned()
        .await
        .map_err(|_| AppError::Internal)?;
    std::thread::spawn(move || {
        let _permit = zip_build_permit;
        run_zip_writer_thread(input_rx, output_tx)
    });

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
