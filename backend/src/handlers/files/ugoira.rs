//! Ugoira 预览：按帧流式加载
//!
//! 首次访问时一次性解压全部帧并写入缓存，后续 metadata/帧 请求仅做内存查找，零 ZIP 解析。

use axum::extract::{Path, State};
use std::io::Cursor;
use std::sync::Arc;
use uuid::Uuid;
use zip::ZipArchive;

use crate::extractors::AuthenticatedUserQuery;
use crate::models::ugoira::{UgoiraCacheEntry, UgoiraMetadata};
use crate::utils::response::{file_response, json_response};
use crate::utils::AppError;
use crate::AppState;

/// 返回 frames.json 元数据。
/// 未命中缓存时读盘并一次性解压全部帧后写入缓存，后续首帧及多帧请求直接内存取。
pub async fn ugoira_metadata_handler(
    State(state): State<AppState>,
    AuthenticatedUserQuery(user_id): AuthenticatedUserQuery,
    Path(file_id): Path<Uuid>,
) -> Result<axum::response::Response, AppError> {
    let file = state.file_service.get_file(file_id, user_id).await?;
    if !is_ugoira_file(&file.mime_type, &file.original_filename) {
        return Err(AppError::NotFound);
    }
    let entry = match state.cache.get_ugoira(file_id, user_id) {
        Some(cached) => cached,
        None => {
            let bytes = state.file_service.get_file_data(&file).await?;
            let entry = tokio::task::spawn_blocking(move || extract_ugoira_all(&bytes))
                .await
                .map_err(|_| AppError::Internal)??;
            let entry = Arc::new(entry);
            state.cache.set_ugoira(file_id, user_id, entry.clone());
            entry
        }
    };
    Ok(json_response(entry.metadata.clone()))
}

/// 返回指定索引的帧图。命中缓存时仅数组下标访问，无 ZIP 解析。
pub async fn ugoira_frame_handler(
    State(state): State<AppState>,
    AuthenticatedUserQuery(user_id): AuthenticatedUserQuery,
    Path((file_id, index)): Path<(Uuid, u32)>,
) -> Result<axum::response::Response, AppError> {
    let file = state.file_service.get_file(file_id, user_id).await?;
    if !is_ugoira_file(&file.mime_type, &file.original_filename) {
        return Err(AppError::NotFound);
    }
    let entry = match state.cache.get_ugoira(file_id, user_id) {
        Some(cached) => cached,
        None => {
            let bytes = state.file_service.get_file_data(&file).await?;
            let entry = tokio::task::spawn_blocking(move || extract_ugoira_all(&bytes))
                .await
                .map_err(|_| AppError::Internal)??;
            let entry = Arc::new(entry);
            state.cache.set_ugoira(file_id, user_id, entry.clone());
            entry
        }
    };
    let (frame_data, mime) = entry
        .frames
        .get(index as usize)
        .cloned()
        .ok_or(AppError::NotFound)?;
    file_response(frame_data, "frame", &mime, true).map_err(|_| AppError::Internal)
}

fn is_ugoira_file(mime_type: &str, filename: &str) -> bool {
    mime_type == "application/x-ugoira"
        || (mime_type == "application/zip"
            && filename.to_lowercase().ends_with(".ugoira"))
}

/// 一次打开 ZIP，解析 metadata 并解压全部帧，后续请求零解析。
fn extract_ugoira_all(data: &[u8]) -> Result<UgoiraCacheEntry, AppError> {
    let mut zip = ZipArchive::new(Cursor::new(data))
        .map_err(|e| AppError::File(format!("无效的 Ugoira ZIP: {}", e)))?;
    let meta_file = zip
        .by_name("frames.json")
        .map_err(|_| AppError::File("缺少 frames.json".to_string()))?;
    let metadata: UgoiraMetadata = serde_json::from_reader(meta_file)
        .map_err(|e| AppError::File(format!("frames.json 解析失败: {}", e)))?;
    if metadata.frames.is_empty() {
        return Err(AppError::File("frames.json 无帧数据".to_string()));
    }
    let mut frames = Vec::with_capacity(metadata.frames.len());
    for (index, frame_info) in metadata.frames.iter().enumerate() {
        let file_name = frame_info
            .file
            .clone()
            .unwrap_or_else(|| format!("{}.png", index));
        let mut frame_file = zip
            .by_name(&file_name)
            .map_err(|_| AppError::File(format!("缺少帧文件: {}", file_name)))?;
        let mut buf = Vec::with_capacity(frame_file.size() as usize);
        std::io::copy(&mut frame_file, &mut buf)
            .map_err(|e| AppError::File(format!("读取帧失败: {}", e)))?;
        let mime = if file_name.ends_with(".png") {
            "image/png".to_string()
        } else if file_name.ends_with(".jpg") || file_name.ends_with(".jpeg") {
            "image/jpeg".to_string()
        } else {
            "image/png".to_string()
        };
        frames.push((buf, mime));
    }
    Ok(UgoiraCacheEntry { metadata, frames })
}
