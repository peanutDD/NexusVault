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

use super::{FileService, FileServiceError};

impl FileService {
    // =============================================================================
    // 会话初始化
    // =============================================================================
    pub async fn init_chunked_upload(
        &self,
        user_id: Uuid,
        req: InitChunkedUploadRequest,
    ) -> Result<(Uuid, u32, u32), FileServiceError> {
        // 先做配额/类型校验，避免创建一个“无论如何都无法完成”的会话，徒增清理成本。
        // 复用统一校验逻辑，但保持原先错误信息（更短、更贴近该场景）
        self.ensure_can_store_quota_simple(user_id, &req.mime_type, req.total_size)
            .await?;

        let mut active_count =
            crate::repositories::upload_sessions::UploadSessionsRepo::new(&self.pool)
                .count_active_sessions_by_user(user_id)
                .await?;

        // 达到上限时，尝试自动取消最旧会话以腾出名额，避免用户被“永久卡死在上限”。
        // 如果达到上限，自动清理最旧的一个会话，为新上传腾出空间
        if active_count >= MAX_CONCURRENT_CHUNKED_UPLOADS {
            let repo = crate::repositories::upload_sessions::UploadSessionsRepo::new(&self.pool);
            if let Some((old_id, old_path)) =
                repo.get_oldest_active_session_by_user(user_id).await?
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
            return Err(FileServiceError::TooManyConcurrentUploads {
                limit: MAX_CONCURRENT_CHUNKED_UPLOADS,
            });
        }

        let upload_id = Uuid::new_v4();
        // API 中 part 是从 1 开始；磁盘落盘使用 0-based（part_0..part_{n-1}）便于顺序合并。
        let total_parts = Self::chunked_total_parts(req.total_size);
        let temp_path = self.chunked_temp_dir(upload_id);
        tokio::fs::create_dir_all(&temp_path)
            .await
            .map_err(|source| FileServiceError::CreateChunkTempDir { source })?;

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

    // =============================================================================
    // 会话读取 / 过期处理
    // =============================================================================
    pub async fn get_upload_session(
        &self,
        upload_id: Uuid,
        user_id: Uuid,
    ) -> Result<UploadSession, FileServiceError> {
        let s = crate::repositories::upload_sessions::UploadSessionsRepo::new(&self.pool)
            .get_session(upload_id, user_id)
            .await?
            .ok_or(FileServiceError::NotFound)?;

        // 访问到过期会话时立即清理，避免临时目录长期堆积占用磁盘空间。
        if s.expires_at < Utc::now() {
            self.abort_chunked_upload(upload_id, user_id).await?;
            return Err(FileServiceError::UploadSessionExpired);
        }
        Ok(s)
    }

    // =============================================================================
    // 分块上传
    // =============================================================================
    pub async fn upload_chunk(
        &self,
        upload_id: Uuid,
        user_id: Uuid,
        part_index: u32,
        data: Bytes,
        part_sha256: Option<&str>,
    ) -> Result<(), FileServiceError> {
        let s = self.get_upload_session(upload_id, user_id).await?;
        let total_size = s.total_size as u64;
        let total_parts = Self::chunked_total_parts(total_size);
        if part_index == 0 || part_index > total_parts {
            return Err(FileServiceError::InvalidChunkIndex { part_index });
        }

        let part = part_index as i32;
        if s.uploaded_parts.contains(&part) {
            tracing::debug!(
                upload_id = %upload_id,
                part = part,
                "chunk already uploaded, skip"
            );
            return Ok(());
        }

        let expected_size = Self::chunked_expected_part_size(total_size, part_index);
        let actual_size = data.len() as u64;
        if actual_size != expected_size {
            return Err(FileServiceError::InvalidChunkSize {
                part_index,
                expected: expected_size,
                actual: actual_size,
            });
        }

        // 可选完整性校验：客户端通过 X-Part-SHA256 提供分块摘要，服务端校验通过才写入，
        // 用于防止断点续传状态错乱或传输中数据损坏。
        if let Some(expected_hex) = part_sha256 {
            let actual = crate::utils::sha256_hex(&data);
            if expected_hex.len() != 64 || !expected_hex.chars().all(|c| c.is_ascii_hexdigit()) {
                return Err(FileServiceError::InvalidPartSha256Header);
            }
            if !expected_hex.eq_ignore_ascii_case(&actual) {
                return Err(FileServiceError::ChunkChecksumMismatch { part_index });
            }
        }

        // 磁盘空间保护（best-effort）：写分块前检查 temp_path 所在盘剩余空间
        if let Ok(free) = fs2::available_space(&s.temp_path) {
            let need = data.len() as u64;
            if free < need.saturating_add(DISK_RESERVE_CHUNK) {
                return Err(FileServiceError::InsufficientDiskSpaceForChunk);
            }
        }

        // 磁盘分块命名：part_{0-based}，保证合并时顺序确定。
        let path = Path::new(&s.temp_path).join(format!("part_{}", part - 1));
        tokio::fs::write(&path, &data)
            .await
            .map_err(|source| FileServiceError::WriteChunk { source })?;

        // 上传进度写入 DB：断线/刷新后可继续断点续传。
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

    // =============================================================================
    // 状态查询
    // =============================================================================
    pub async fn chunked_upload_status(
        &self,
        upload_id: Uuid,
        user_id: Uuid,
    ) -> Result<(Vec<i32>, u32), FileServiceError> {
        let s = self.get_upload_session(upload_id, user_id).await?;
        let total_parts = Self::chunked_total_parts(s.total_size as u64);
        tracing::debug!(
            upload_id = %upload_id,
            uploaded = s.uploaded_parts.len(),
            total_parts = total_parts,
            "chunked upload status"
        );
        Ok((s.uploaded_parts, total_parts))
    }

    // =============================================================================
    // 完成（合并 + 创建文件记录）
    // =============================================================================
    pub async fn complete_chunked_upload(
        &self,
        upload_id: Uuid,
        user_id: Uuid,
        req: CompleteChunkedUploadRequest,
    ) -> Result<FileResponse, FileServiceError> {
        use tokio::io::{copy, AsyncWriteExt};

        let s = self.get_upload_session(upload_id, user_id).await?;
        let total_parts = Self::chunked_total_parts(s.total_size as u64);
        if s.uploaded_parts.len() != total_parts as usize {
            return Err(FileServiceError::MissingUploadedChunks {
                uploaded: s.uploaded_parts.len(),
                total: total_parts,
            });
        }

        // 磁盘空间保护（best-effort）：合并前检查剩余空间是否足够容纳最终文件
        if let Ok(free) = fs2::available_space(&s.temp_path) {
            let need = s.total_size.max(0) as u64;
            if free < need.saturating_add(DISK_RESERVE_MERGE) {
                return Err(FileServiceError::InsufficientDiskSpaceForMerge);
            }
        }

        tracing::info!(
            upload_id = %upload_id,
            filename = %s.filename,
            total_size = s.total_size,
            total_parts = total_parts,
            "chunked upload complete: start merge"
        );

        // 合并采用流式 copy，避免把整文件读入 Vec<u8>（高并发下有 OOM 风险）。
        // 流式合并：避免把整个文件读入 Vec<u8>，高并发下防止 OOM
        let base_path = Path::new(&s.temp_path);
        let merged_path = base_path.join("merged_upload");

        let mut out = tokio::fs::File::create(&merged_path)
            .await
            .map_err(|source| FileServiceError::CreateMergedFile { source })?;

        for part_idx in 0..total_parts {
            let chunk_path = base_path.join(format!("part_{}", part_idx));
            let mut input = tokio::fs::File::open(&chunk_path).await.map_err(|source| {
                FileServiceError::ReadChunk {
                    part_index: part_idx,
                    source,
                }
            })?;
            copy(&mut input, &mut out)
                .await
                .map_err(|source| FileServiceError::MergeChunks { source })?;
        }
        out.flush()
            .await
            .map_err(|source| FileServiceError::FlushMergedFile { source })?;

        tracing::info!(upload_id = %upload_id, "merge done, verifying size");

        let merged_size = tokio::fs::metadata(&merged_path)
            .await
            .map_err(|source| FileServiceError::StatMergedFile { source })?
            .len();
        if merged_size != s.total_size as u64 {
            return Err(FileServiceError::MergedFileSizeMismatch);
        }

        // 整文件 SHA-256 用于秒传/内容匹配等逻辑（同时作为内容指纹便于后续优化）。
        let content_sha256: Option<String> = match tokio::task::spawn_blocking({
            let p = merged_path.clone();
            move || crate::utils::sha256_file_hex(&p)
        })
        .await
        {
            Ok(Ok(h)) => Some(h),
            Ok(Err(e)) => return Err(e.into()),
            Err(_) => return Err(FileServiceError::BackgroundHashTask),
        };
        let content_sha256 = content_sha256.as_deref();
        tracing::info!(
            upload_id = %upload_id,
            has_sha256 = content_sha256.is_some(),
            "hash done, creating file record"
        );

        let file = self
            .create_file_from_path(super::CreateFileFromPathInput {
                user_id,
                original_filename: s.filename.clone(),
                mime_type: s.mime_type.clone(),
                file_size: s.total_size as u64,
                source_path: &merged_path,
                content_sha256,
                folder_id: req.folder_id,
                allow_versioning: true,
                review_status: "approved",
            })
            .await?;

        tracing::info!(
            upload_id = %upload_id,
            file_id = %file.id,
            "chunked upload complete, cleanup temp"
        );
        self.abort_chunked_upload(upload_id, user_id).await?;
        Ok(file)
    }

    // =============================================================================
    // 取消（清理）
    // =============================================================================
    pub async fn abort_chunked_upload(
        &self,
        upload_id: Uuid,
        user_id: Uuid,
    ) -> Result<(), FileServiceError> {
        // 磁盘清理 best-effort；DB 记录删除是“事实来源”，不能因为磁盘问题阻塞取消流程。
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

    fn chunked_total_parts(total_size: u64) -> u32 {
        total_size.div_ceil(CHUNK_SIZE as u64) as u32
    }

    fn chunked_expected_part_size(total_size: u64, part_index: u32) -> u64 {
        let total_parts = Self::chunked_total_parts(total_size);
        if part_index == total_parts {
            let consumed = CHUNK_SIZE as u64 * u64::from(total_parts.saturating_sub(1));
            return total_size.saturating_sub(consumed);
        }
        CHUNK_SIZE as u64
    }
}

#[cfg(test)]
mod tests {
    use super::FileService;
    use crate::constants::CHUNK_SIZE;

    #[test]
    fn chunked_part_dimensions_are_centralized_for_init_and_validation() {
        let total_size = CHUNK_SIZE as u64 * 2 + 7;

        assert_eq!(FileService::chunked_total_parts(total_size), 3);
        assert_eq!(
            FileService::chunked_expected_part_size(total_size, 1),
            CHUNK_SIZE as u64
        );
        assert_eq!(
            FileService::chunked_expected_part_size(total_size, 2),
            CHUNK_SIZE as u64
        );
        assert_eq!(FileService::chunked_expected_part_size(total_size, 3), 7);
    }

    #[test]
    fn chunked_part_dimensions_handle_single_partial_part() {
        assert_eq!(FileService::chunked_total_parts(13), 1);
        assert_eq!(FileService::chunked_expected_part_size(13, 1), 13);
    }
}
