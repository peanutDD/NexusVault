//! 秒传（文件指纹）
//!
//! 客户端先计算文件 SHA-256，请求此接口；若服务器已有相同 content_sha256 + file_size 的文件，
//! 则复制文件到当前用户目录并创建新记录，避免跨用户路径引用导致的不一致。

use std::path::Path;
use uuid::Uuid;

use crate::models::file::{FileResponse, InstantUploadRequest};
use crate::utils::AppError;

use super::upload::build_storage_filename;
use super::FileService;

/// SHA-256 十六进制长度
const SHA256_HEX_LEN: usize = 64;

impl FileService {
    /// 秒传：按 content_sha256 + file_size 查找已有文件，若存在则复制到当前用户目录并创建新记录。
    /// 返回 Some(file) 表示秒传成功，None 表示服务器无该内容、客户端需走普通/分片上传。
    ///
    /// **修正**：若已有文件的路径属于其他用户，复制文件到新用户目录，避免「DB user_id 与路径 user_id 不一致」。
    pub async fn instant_upload(
        &self,
        user_id: Uuid,
        mut req: InstantUploadRequest,
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

        // 检查已有文件的路径是否属于当前用户
        // LocalStorage: uploads/<user_id>/<file_id>/<filename>
        // S3: <user_id>/<file_id>/<filename>
        // 提取路径中的第一个 UUID（通常是 user_id）
        let existing_path = Path::new(&existing.file_path);
        let path_user_id = existing_path
            .components()
            .find_map(|c| {
                if let std::path::Component::Normal(name) = c {
                    Uuid::parse_str(name.to_str()?).ok()
                } else {
                    None
                }
            });

        // 若路径属于其他用户，复制文件到当前用户目录；否则复用路径（节省存储）
        let file_path = if path_user_id == Some(user_id) {
            // 路径已属于当前用户，可直接复用
            existing.file_path.clone()
        } else {
            // 路径属于其他用户（或无法解析），复制到当前用户目录，避免跨用户路径引用
            // 先读取源文件内容，再写入新路径（兼容 LocalStorage 和 S3）
            let source_data = self.storage.get_file(&existing.file_path).await?;
            let new_path = self
                .storage
                .save_file(user_id, file_id, &storage_filename, &source_data)
                .await?;
            new_path
        };

        let file = self
            .files_repo
            .insert(
                file_id,
                user_id,
                &storage_filename,
                &req.filename,
                &file_path,
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
