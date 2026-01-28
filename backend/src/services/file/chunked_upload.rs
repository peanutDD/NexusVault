//! 分块上传（可恢复上传）

use std::path::Path;

use bytes::Bytes;
use chrono::Utc;
use uuid::Uuid;

use crate::models::file::FileResponse;
use crate::models::upload_session::{
    CompleteChunkedUploadRequest, InitChunkedUploadRequest, UploadSession,
};
use crate::utils::AppError;

use super::{FileService, CHUNK_SIZE};

impl FileService {
    pub async fn init_chunked_upload(
        &self,
        user_id: Uuid,
        req: InitChunkedUploadRequest,
    ) -> Result<(Uuid, u32, u32), AppError> {
        // 复用统一校验逻辑，但保持原先错误信息（更短、更贴近该场景）
        self.ensure_can_store_quota_simple(user_id, &req.mime_type, req.total_size)
            .await?;

        let upload_id = Uuid::new_v4();
        let total_parts = req.total_size.div_ceil(CHUNK_SIZE as u64) as u32;
        let temp_path = self.chunked_temp_dir(upload_id);
        tokio::fs::create_dir_all(&temp_path)
            .await
            .map_err(|e| AppError::Storage(format!("Failed to create temp dir: {}", e)))?;

        let path_str = temp_path.to_string_lossy().to_string();
        let expires = Utc::now() + chrono::Duration::hours(24);
        sqlx::query(
            "INSERT INTO upload_sessions (id, user_id, filename, mime_type, total_size, chunk_size, temp_path, expires_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
        )
        .bind(upload_id)
        .bind(user_id)
        .bind(&req.filename)
        .bind(&req.mime_type)
        .bind(req.total_size as i64)
        .bind(CHUNK_SIZE as i32)
        .bind(&path_str)
        .bind(expires)
        .execute(&self.pool)
        .await?;

        Ok((upload_id, CHUNK_SIZE, total_parts))
    }

    pub async fn get_upload_session(
        &self,
        upload_id: Uuid,
        user_id: Uuid,
    ) -> Result<UploadSession, AppError> {
        let s = sqlx::query_as::<_, UploadSession>(
            "SELECT id, user_id, filename, mime_type, total_size, chunk_size, temp_path,
                    COALESCE(uploaded_parts, '{}') as uploaded_parts, created_at, expires_at
             FROM upload_sessions WHERE id = $1 AND user_id = $2",
        )
        .bind(upload_id)
        .bind(user_id)
        .fetch_optional(&self.pool)
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
    ) -> Result<(), AppError> {
        let s = self.get_upload_session(upload_id, user_id).await?;
        let part = part_index as i32;
        if s.uploaded_parts.contains(&part) {
            return Ok(());
        }
        let total_parts = (s.total_size as u64).div_ceil(CHUNK_SIZE as u64) as i32;
        if part < 1 || part > total_parts {
            return Err(AppError::Validation(format!(
                "无效的分块索引: {}",
                part_index
            )));
        }

        // 磁盘空间保护（best-effort）：写分块前检查 temp_path 所在盘剩余空间
        if let Ok(free) = fs2::available_space(&s.temp_path) {
            let reserve = 32 * 1024 * 1024u64; // 32MiB safety margin
            let need = data.len() as u64;
            if free < need.saturating_add(reserve) {
                return Err(AppError::Storage("磁盘空间不足，请稍后重试".to_string()));
            }
        }

        let path = Path::new(&s.temp_path).join(format!("part_{}", part - 1));
        tokio::fs::write(&path, &data)
            .await
            .map_err(|e| AppError::Storage(format!("Failed to write chunk: {}", e)))?;

        // uploaded_parts 并发安全：用 SQL 原子追加，避免“读-改-写”丢更新
        sqlx::query(
            "UPDATE upload_sessions
             SET uploaded_parts = array_append(uploaded_parts, $1)
             WHERE id = $2 AND user_id = $3 AND NOT ($1 = ANY(uploaded_parts))",
        )
        .bind(part)
        .bind(upload_id)
        .bind(user_id)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn chunked_upload_status(
        &self,
        upload_id: Uuid,
        user_id: Uuid,
    ) -> Result<(Vec<i32>, u32), AppError> {
        let s = self.get_upload_session(upload_id, user_id).await?;
        let total_parts = (s.total_size as u64).div_ceil(CHUNK_SIZE as u64) as u32;
        Ok((s.uploaded_parts, total_parts))
    }

    pub async fn complete_chunked_upload(
        &self,
        upload_id: Uuid,
        user_id: Uuid,
        _req: CompleteChunkedUploadRequest,
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
            let reserve = 64 * 1024 * 1024u64; // 64MiB safety margin
            let need = s.total_size.max(0) as u64;
            if free < need.saturating_add(reserve) {
                return Err(AppError::Storage("磁盘空间不足，无法完成合并".to_string()));
            }
        }

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

        let merged_size = tokio::fs::metadata(&merged_path)
            .await
            .map_err(|e| AppError::Storage(format!("Failed to stat merged file: {}", e)))?
            .len();
        if merged_size != s.total_size as u64 {
            return Err(AppError::Validation("文件大小不匹配".to_string()));
        }

        let file = self
            .create_file_from_path(
                user_id,
                s.filename.clone(),
                s.mime_type.clone(),
                s.total_size as u64,
                &merged_path,
            )
            .await?;

        self.abort_chunked_upload(upload_id, user_id).await?;
        Ok(file)
    }

    pub async fn abort_chunked_upload(
        &self,
        upload_id: Uuid,
        user_id: Uuid,
    ) -> Result<(), AppError> {
        let temp_path = self.chunked_temp_dir(upload_id);
        if temp_path.exists() {
            let _ = tokio::fs::remove_dir_all(&temp_path).await;
        }
        sqlx::query("DELETE FROM upload_sessions WHERE id = $1 AND user_id = $2")
            .bind(upload_id)
            .bind(user_id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }
}

