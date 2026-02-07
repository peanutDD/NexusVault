//! 秒传（文件指纹）
//!
//! 客户端先计算文件 SHA-256，请求此接口；若服务器已有相同 content_sha256 + file_size 的文件，
//! 则直接创建一条新文件记录复用同一存储路径，不传输文件内容。

use uuid::Uuid;

use crate::models::file::{FileResponse, InstantUploadRequest};
use crate::utils::AppError;

use super::upload::build_storage_filename;
use super::FileService;

/// SHA-256 十六进制长度
const SHA256_HEX_LEN: usize = 64;

impl FileService {
    /// 秒传：按 content_sha256 + file_size 查找已有文件，若存在则复用存储并创建新记录
    /// 返回 Some(file) 表示秒传成功，None 表示服务器无该内容、客户端需走普通/分片上传。
    pub async fn instant_upload(
        &self,
        user_id: Uuid,
        req: InstantUploadRequest,
    ) -> Result<Option<FileResponse>, AppError> {
        let hash = req.content_sha256.trim();
        if hash.len() != SHA256_HEX_LEN
            || !hash.chars().all(|c| c.is_ascii_hexdigit())
        {
            return Err(AppError::Validation(
                "content_sha256 须为 64 位十六进制字符串".to_string(),
            ));
        }

        self.ensure_can_store_detailed(user_id, &req.mime_type, req.file_size)
            .await?;

        let existing = self
            .files_repo
            .find_by_content_hash_and_size(hash, req.file_size)
            .await?;

        let existing = match existing {
            Some(f) => f,
            None => return Ok(None),
        };

        let file_id = Uuid::new_v4();
        let storage_filename = build_storage_filename(file_id, &req.filename)?;

        let file = self
            .files_repo
            .insert(
                file_id,
                user_id,
                &storage_filename,
                &req.filename,
                &existing.file_path,
                req.file_size,
                &req.mime_type,
                &existing.storage_backend,
                Some(hash),
                req.folder_id,
            )
            .await?;

        Ok(Some(FileResponse::from(file)))
    }
}
