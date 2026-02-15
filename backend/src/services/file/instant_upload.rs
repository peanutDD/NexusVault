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
        req: InstantUploadRequest,
    ) -> Result<Option<FileResponse>, AppError> {
        let hash = req.content_sha256.trim();
        if hash.len() != SHA256_HEX_LEN || !hash.chars().all(|c| c.is_ascii_hexdigit()) {
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
        let path_user_id = existing_path.components().find_map(|c| {
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

        // 检查是否存在同名文件（在同一文件夹下）
        let existing_file = self
            .files_repo
            .find_by_name_and_folder(user_id, &req.filename, req.folder_id)
            .await?;

        let file = if let Some(existing_same_name) = existing_file {
            // 存在同名文件，需要创建版本
            let existing_file_id = existing_same_name.id;

            // 获取当前最大版本号
            let max_version = self
                .file_versions_repo
                .get_max_version_number(existing_file_id)
                .await?;
            let next_version = max_version + 1;

            // 将旧文件保存为历史版本
            let _ = self
                .file_versions_repo
                .create_version(
                    existing_file_id,
                    user_id,
                    next_version,
                    &existing_same_name.filename,
                    &existing_same_name.original_filename,
                    &existing_same_name.file_path,
                    existing_same_name.file_size as u64,
                    &existing_same_name.mime_type,
                    &existing_same_name.storage_backend,
                    existing_same_name.content_sha256.as_deref(),
                )
                .await;

            // 更新文件记录为新文件
            sqlx::query(
                "UPDATE files SET 
                    filename = $1, file_path = $2, file_size = $3, 
                    mime_type = $4, content_sha256 = $5, updated_at = CURRENT_TIMESTAMP
                 WHERE id = $6 AND user_id = $7",
            )
            .bind(&storage_filename)
            .bind(&file_path)
            .bind(req.file_size as i64)
            .bind(&req.mime_type)
            .bind(Some(hash))
            .bind(existing_file_id)
            .bind(user_id)
            .execute(&self.pool)
            .await?;

            // 清理旧版本（只保留最近2个）
            let old_version_paths = self
                .file_versions_repo
                .cleanup_old_versions(existing_file_id, 2)
                .await?;
            for old_path in old_version_paths {
                let _ = self.storage.delete_file(&old_path).await;
            }

            // 重新查询更新后的文件
            let file_response = self
                .files_repo
                .find_by_id(existing_file_id, user_id)
                .await?
                .ok_or(AppError::NotFound)
                .map(FileResponse::from)?;

            // 如果配置了嵌入服务，异步提取内容并生成向量嵌入（不阻塞上传流程）
            if let Some(embedding_service) = &self.embedding_service {
                if let Ok(Some(file_clone)) =
                    self.files_repo.find_by_id(existing_file_id, user_id).await
                {
                    let task = crate::services::file::EmbeddingTaskInput {
                        embedding_service: embedding_service.clone(),
                        storage: self.storage.clone(),
                        file: file_clone,
                        mime_type: req.mime_type.clone(),
                        original_filename: req.filename.clone(),
                        file_id: file_response.id,
                        user_id,
                        pool: self.pool.clone(),
                    };

                    tokio::spawn(async move {
                        crate::services::file::FileService::generate_embedding_with_content(task)
                            .await;
                    });
                }
            }

            file_response
        } else {
            // 不存在同名文件，创建新文件
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
            let file_response = FileResponse::from(file);

            // 如果配置了嵌入服务，异步提取内容并生成向量嵌入（不阻塞上传流程）
            if let Some(embedding_service) = &self.embedding_service {
                if let Ok(Some(file_clone)) =
                    self.files_repo.find_by_id(file_response.id, user_id).await
                {
                    let task = crate::services::file::EmbeddingTaskInput {
                        embedding_service: embedding_service.clone(),
                        storage: self.storage.clone(),
                        file: file_clone,
                        mime_type: req.mime_type.clone(),
                        original_filename: req.filename.clone(),
                        file_id: file_response.id,
                        user_id,
                        pool: self.pool.clone(),
                    };

                    tokio::spawn(async move {
                        crate::services::file::FileService::generate_embedding_with_content(task)
                            .await;
                    });
                }
            }

            file_response
        };

        Ok(Some(file))
    }
}
