//! 分块上传（可恢复上传）

use std::path::Path;

use bytes::Bytes;
use chrono::Utc;
use uuid::Uuid;

use crate::constants::{
    CHUNK_SIZE, DISK_RESERVE_CHUNK, DISK_RESERVE_MERGE, MAX_CONCURRENT_CHUNKED_UPLOADS,
};
use crate::models::file::FileResponse;
use crate::models::upload_session::{
    CompleteChunkedUploadRequest, InitChunkedUploadRequest, UploadSession,
};
use crate::utils::AppError;

use super::FileService;

impl FileService {
    pub async fn init_chunked_upload(
        &self,
        user_id: Uuid,
        mut req: InitChunkedUploadRequest,
    ) -> Result<(Uuid, u32, u32), AppError> {
        // 复用统一校验逻辑，但保持原先错误信息（更短、更贴近该场景）
        self.ensure_can_store_quota_simple(user_id, &req.mime_type, req.total_size)
            .await?;

        let mut active_count =
            crate::repositories::upload_sessions::UploadSessionsRepo::new(&self.pool)
                .count_active_sessions_by_user(user_id)
                .await?;

        // 如果达到上限，自动清理最旧的一个会话，为新上传腾出空间
        if active_count >= MAX_CONCURRENT_CHUNKED_UPLOADS {
            let repo = crate::repositories::upload_sessions::UploadSessionsRepo::new(&self.pool);
            if let Some((old_id, old_path)) = repo.get_oldest_active_session_by_user(user_id).await?
            {
                tracing::info!(
                    user_id = %user_id,
                    old_upload_id = %old_id,
                    "max concurrent uploads reached, auto-aborting oldest session"
                );
                // 忽略物理删除错误，重点是清理 DB 记录
                let _ = tokio::fs::remove_dir_all(&old_path).await;
                repo.delete_session(old_id, user_id).await?;
                active_count -= 1;
            }
        }

        if active_count >= MAX_CONCURRENT_CHUNKED_UPLOADS {
            return Err(AppError::Validation(format!(
                "同时进行的分片上传不能超过 {} 个，请先完成或取消其他大文件上传",
                MAX_CONCURRENT_CHUNKED_UPLOADS
            )));
        }

        let upload_id = Uuid::new_v4();
        let total_parts = req.total_size.div_ceil(CHUNK_SIZE as u64) as u32;
        let temp_path = self.chunked_temp_dir(upload_id);
        tokio::fs::create_dir_all(&temp_path)
            .await
            .map_err(|e| AppError::Storage(format!("Failed to create temp dir: {}", e)))?;

        let path_str = temp_path.to_string_lossy().to_string();
        let expires = Utc::now() + chrono::Duration::hours(24);
        crate::repositories::upload_sessions::UploadSessionsRepo::new(&self.pool)
            .insert_session(
                upload_id,
                user_id,
                &req.filename,
                &req.mime_type,
                req.total_size,
                CHUNK_SIZE as i32,
                &path_str,
                expires,
            )
            .await?;

        tracing::info!(
            upload_id = %upload_id,
            user_id = %user_id,
            filename = %req.filename,
            total_size = req.total_size,
            total_parts = total_parts,
            chunk_size = CHUNK_SIZE,
            "chunked upload init"
        );
        Ok((upload_id, CHUNK_SIZE, total_parts))
    }

    pub async fn get_upload_session(
        &self,
        upload_id: Uuid,
        user_id: Uuid,
    ) -> Result<UploadSession, AppError> {
        let s = crate::repositories::upload_sessions::UploadSessionsRepo::new(&self.pool)
            .get_session(upload_id, user_id)
            .await?
            .ok_or(AppError::NotFound)?;

        if s.expires_at < Utc::now() {
            self.abort_chunked_upload(upload_id, user_id).await?;
            return Err(AppError::Validation("上传会话已过期".to_string()));
        }
        Ok(s)
    }

    pub async fn upload_chunk(
        &self,
        upload_id: Uuid,
        user_id: Uuid,
        part_index: u32,
        data: Bytes,
        part_sha256: Option<&str>,
    ) -> Result<(), AppError> {
        let s = self.get_upload_session(upload_id, user_id).await?;
        let part = part_index as i32;
        if s.uploaded_parts.contains(&part) {
            tracing::debug!(
                upload_id = %upload_id,
                part = part,
                "chunk already uploaded, skip"
            );
            return Ok(());
        }
        let total_parts = (s.total_size as u64).div_ceil(CHUNK_SIZE as u64) as i32;
        if part < 1 || part > total_parts {
            return Err(AppError::Validation(format!(
                "无效的分块索引: {}",
                part_index
            )));
        }

        if let Some(expected_hex) = part_sha256 {
            let actual = crate::utils::sha256_hex(&data);
            if expected_hex.len() != 64 || !expected_hex.chars().all(|c| c.is_ascii_hexdigit()) {
                return Err(AppError::Validation(
                    "X-Part-SHA256 须为 64 位十六进制".to_string(),
                ));
            }
            if !expected_hex.eq_ignore_ascii_case(&actual) {
                return Err(AppError::Validation(format!(
                    "分块 {} 校验失败: SHA-256 不匹配",
                    part_index
                )));
            }
        }

        // 磁盘空间保护（best-effort）：写分块前检查 temp_path 所在盘剩余空间
        if let Ok(free) = fs2::available_space(&s.temp_path) {
            let need = data.len() as u64;
            if free < need.saturating_add(DISK_RESERVE_CHUNK) {
                return Err(AppError::Storage("磁盘空间不足，请稍后重试".to_string()));
            }
        }

        let path = Path::new(&s.temp_path).join(format!("part_{}", part - 1));
        tokio::fs::write(&path, &data)
            .await
            .map_err(|e| AppError::Storage(format!("Failed to write chunk: {}", e)))?;

        crate::repositories::upload_sessions::UploadSessionsRepo::new(&self.pool)
            .append_uploaded_part(upload_id, user_id, part)
            .await?;

        tracing::info!(
            upload_id = %upload_id,
            part = part,
            bytes = data.len(),
            "chunk written"
        );
        Ok(())
    }

    pub async fn chunked_upload_status(
        &self,
        upload_id: Uuid,
        user_id: Uuid,
    ) -> Result<(Vec<i32>, u32), AppError> {
        let s = self.get_upload_session(upload_id, user_id).await?;
        let total_parts = (s.total_size as u64).div_ceil(CHUNK_SIZE as u64) as u32;
        tracing::debug!(
            upload_id = %upload_id,
            uploaded = s.uploaded_parts.len(),
            total_parts = total_parts,
            "chunked upload status"
        );
        Ok((s.uploaded_parts, total_parts))
    }

    pub async fn complete_chunked_upload(
        &self,
        upload_id: Uuid,
        user_id: Uuid,
        req: CompleteChunkedUploadRequest,
    ) -> Result<FileResponse, AppError> {
        use tokio::io::{copy, AsyncWriteExt};

        let s = self.get_upload_session(upload_id, user_id).await?;
        let total_parts = (s.total_size as u64).div_ceil(CHUNK_SIZE as u64) as u32;
        if s.uploaded_parts.len() != total_parts as usize {
            return Err(AppError::Validation(format!(
                "缺少分块: 已上传 {}/{}",
                s.uploaded_parts.len(),
                total_parts
            )));
        }

        // 磁盘空间保护（best-effort）：合并前检查剩余空间是否足够容纳最终文件
        if let Ok(free) = fs2::available_space(&s.temp_path) {
            let need = s.total_size.max(0) as u64;
            if free < need.saturating_add(DISK_RESERVE_MERGE) {
                return Err(AppError::Storage("磁盘空间不足，无法完成合并".to_string()));
            }
        }

        tracing::info!(
            upload_id = %upload_id,
            filename = %s.filename,
            total_size = s.total_size,
            total_parts = total_parts,
            "chunked upload complete: start merge"
        );

        // 流式合并：避免把整个文件读入 Vec<u8>，高并发下防止 OOM
        let base_path = Path::new(&s.temp_path);
        let merged_path = base_path.join("merged_upload");

        let mut out = tokio::fs::File::create(&merged_path)
            .await
            .map_err(|e| AppError::Storage(format!("Failed to create merged file: {}", e)))?;

        for part_idx in 0..total_parts {
            let chunk_path = base_path.join(format!("part_{}", part_idx));
            let mut input = tokio::fs::File::open(&chunk_path)
                .await
                .map_err(|e| AppError::File(format!("读取分块 {} 失败: {}", part_idx, e)))?;
            copy(&mut input, &mut out)
                .await
                .map_err(|e| AppError::Storage(format!("Failed to merge chunks: {}", e)))?;
        }
        out.flush()
            .await
            .map_err(|e| AppError::Storage(format!("Failed to flush merged file: {}", e)))?;

        tracing::info!(upload_id = %upload_id, "merge done, verifying size");

        let merged_size = tokio::fs::metadata(&merged_path)
            .await
            .map_err(|e| AppError::Storage(format!("Failed to stat merged file: {}", e)))?
            .len();
        if merged_size != s.total_size as u64 {
            return Err(AppError::Validation("文件大小不匹配".to_string()));
        }

        let content_sha256: Option<String> = match tokio::task::spawn_blocking({
            let p = merged_path.clone();
            move || crate::utils::sha256_file_hex(&p)
        })
        .await
        {
            Ok(Ok(h)) => Some(h),
            Ok(Err(e)) => return Err(e),
            Err(_) => return Err(AppError::Internal),
        };
        let content_sha256 = content_sha256.as_deref();
        tracing::info!(
            upload_id = %upload_id,
            has_sha256 = content_sha256.is_some(),
            "hash done, creating file record"
        );

        let file = self
            .create_file_from_path(
                user_id,
                s.filename.clone(),
                s.mime_type.clone(),
                s.total_size as u64,
                &merged_path,
                content_sha256,
                req.folder_id,
            )
            .await?;

        tracing::info!(
            upload_id = %upload_id,
            file_id = %file.id,
            "chunked upload complete, cleanup temp"
        );
        self.abort_chunked_upload(upload_id, user_id).await?;
        Ok(file)
    }

    pub async fn abort_chunked_upload(
        &self,
        upload_id: Uuid,
        user_id: Uuid,
    ) -> Result<(), AppError> {
        let temp_path = self.chunked_temp_dir(upload_id);
        let existed = temp_path.exists();
        if existed {
            let _ = tokio::fs::remove_dir_all(&temp_path).await;
        }
        crate::repositories::upload_sessions::UploadSessionsRepo::new(&self.pool)
            .delete_session(upload_id, user_id)
            .await?;
        tracing::info!(
            upload_id = %upload_id,
            temp_removed = existed,
            "chunked upload abort"
        );
        Ok(())
    }
}
