//! 上传相关（普通上传 / 从本地路径上传）

use std::path::Path;
use std::sync::Arc;

use uuid::Uuid;

use crate::models::file::File;
use crate::models::file::FileResponse;
use crate::services::embeddings::EmbeddingService;
use crate::services::file_content_extractor::FileContentExtractor;
use crate::services::storage::StorageBackend;
use crate::utils::AppError;
use sqlx::PgPool;

use super::FileService;

pub(crate) fn build_storage_filename(
    file_id: Uuid,
    original_filename: &str,
) -> Result<String, AppError> {
    let sanitized_filename = crate::utils::validation::sanitize_filename(original_filename)?;
    Ok(format!("{}_{}", file_id, sanitized_filename))
}

impl FileService {
    /// 从内存数据创建文件。
    ///
    /// 当前 HTTP 上传路径统一走 multipart / 分片上传，因此暂未直接使用该方法；
    /// 预留给「纯 JSON + Base64 / 直接从第三方拉取字节流再入库」这类 API。
    /// 当你需要提供「服务端从远程拉取并写入存储」的能力时，可以复用此逻辑。
    #[allow(dead_code)]
    pub async fn create_file(
        &self,
        user_id: Uuid,
        original_filename: String,
        mime_type: String,
        file_size: u64,
        data: Vec<u8>,
    ) -> Result<FileResponse, AppError> {
        self.ensure_can_store_detailed(user_id, &mime_type, file_size)
            .await?;

        let file_id = Uuid::new_v4();
        let storage_filename = build_storage_filename(file_id, &original_filename)?;

        // Save file to storage
        let file_path = self
            .storage
            .save_file(user_id, file_id, &storage_filename, &data)
            .await?;

        let inserted = self
            .files_repo
            .insert(
                file_id,
                user_id,
                &storage_filename,
                &original_filename,
                &file_path,
                file_size,
                &mime_type,
                &self.config.storage_backend,
                None,
                None,
            )
            .await
            .map(FileResponse::from);

        // 若落库失败，尽量清理已写入的存储文件，避免产生"孤儿文件"占用空间
        if inserted.is_err() {
            let _ = self.storage.delete_file(&file_path).await;
        }

        inserted
    }

    /// 从本地路径创建文件，可选传入已计算的内容 SHA256（用于秒传落库）
    ///
    /// 如果已存在同名文件（在同一文件夹下），会自动创建版本：
    /// 1. 将当前文件保存为新版本
    /// 2. 将旧文件保存为历史版本
    /// 3. 清理超过保留数量的旧版本（只保留最近2个）
    pub async fn create_file_from_path(
        &self,
        user_id: Uuid,
        original_filename: String,
        mime_type: String,
        file_size: u64,
        source_path: &Path,
        content_sha256: Option<&str>,
        folder_id: Option<Uuid>,
    ) -> Result<FileResponse, AppError> {
        self.ensure_can_store_detailed(user_id, &mime_type, file_size)
            .await?;

        // 检查是否存在同名文件（在同一文件夹下）
        let existing_file = self
            .files_repo
            .find_by_name_and_folder(user_id, &original_filename, folder_id)
            .await?;

        let file_id = if let Some(existing) = existing_file {
            // 存在同名文件，需要创建版本
            let existing_file_id = existing.id;

            // 获取当前最大版本号（如果没有版本，max_version = 0）
            let max_version = self
                .file_versions_repo
                .get_max_version_number(existing_file_id)
                .await?;
            let next_version = max_version + 1;

            // 将旧文件保存为历史版本（版本号 = next_version）
            let _ = self
                .file_versions_repo
                .create_version(
                    existing_file_id,
                    user_id,
                    next_version,
                    &existing.filename,
                    &existing.original_filename,
                    &existing.file_path,
                    existing.file_size as u64,
                    &existing.mime_type,
                    &existing.storage_backend,
                    existing.content_sha256.as_deref(),
                )
                .await;

            // 将新文件保存为当前文件（更新 files 表）
            let storage_filename = build_storage_filename(existing_file_id, &original_filename)?;
            let file_path = self
                .storage
                .save_file_from_path(user_id, existing_file_id, &storage_filename, source_path)
                .await?;

            // 更新文件记录
            sqlx::query(
                "UPDATE files SET 
                    filename = $1, file_path = $2, file_size = $3, 
                    mime_type = $4, content_sha256 = $5, updated_at = CURRENT_TIMESTAMP
                 WHERE id = $6 AND user_id = $7",
            )
            .bind(&storage_filename)
            .bind(&file_path)
            .bind(file_size as i64)
            .bind(&mime_type)
            .bind(content_sha256)
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
                let file_clone = self
                    .files_repo
                    .find_by_id(existing_file_id, user_id)
                    .await?
                    .ok_or(AppError::NotFound)?;
                let embedding_service_clone = embedding_service.clone();
                let storage_clone = self.storage.clone();
                let mime_type_clone = mime_type.clone();
                let original_filename_clone = original_filename.clone();
                let file_id_clone = file_response.id;
                let user_id_clone = user_id;
                let pool_clone = self.pool.clone();

                tokio::spawn(async move {
                    Self::generate_embedding_with_content(
                        &embedding_service_clone,
                        &storage_clone,
                        &file_clone,
                        &mime_type_clone,
                        &original_filename_clone,
                        file_id_clone,
                        user_id_clone,
                        pool_clone,
                    )
                    .await;
                });
            }

            file_response
        } else {
            // 不存在同名文件，创建新文件
            let new_file_id = Uuid::new_v4();
            let storage_filename = build_storage_filename(new_file_id, &original_filename)?;

            // Save file to storage without loading into memory
            let file_path = self
                .storage
                .save_file_from_path(user_id, new_file_id, &storage_filename, source_path)
                .await?;

            let inserted = self
                .files_repo
                .insert(
                    new_file_id,
                    user_id,
                    &storage_filename,
                    &original_filename,
                    &file_path,
                    file_size,
                    &mime_type,
                    &self.config.storage_backend,
                    content_sha256,
                    folder_id,
                )
                .await
                .map(FileResponse::from);

            // 若落库失败，尽量清理已写入的存储文件（此时 source_path 可能已被 move/删除）
            if inserted.is_err() {
                let _ = self.storage.delete_file(&file_path).await;
            }

            let file_response = inserted?;

            // 如果配置了嵌入服务，异步提取内容并生成向量嵌入（不阻塞上传流程）
            if let Some(embedding_service) = &self.embedding_service {
                let file_clone = self
                    .files_repo
                    .find_by_id(file_response.id, user_id)
                    .await?
                    .ok_or(AppError::NotFound)?;
                let embedding_service_clone = embedding_service.clone();
                let storage_clone = self.storage.clone();
                let mime_type_clone = mime_type.clone();
                let original_filename_clone = original_filename.clone();
                let file_id_clone = file_response.id;
                let user_id_clone = user_id;
                let pool_clone = self.pool.clone();

                tokio::spawn(async move {
                    Self::generate_embedding_with_content(
                        &embedding_service_clone,
                        &storage_clone,
                        &file_clone,
                        &mime_type_clone,
                        &original_filename_clone,
                        file_id_clone,
                        user_id_clone,
                        pool_clone,
                    )
                    .await;
                });
            }

            file_response
        };

        Ok(file_id)
    }

    /// 异步生成文件向量嵌入（包含文件名和内容）
    ///
    /// 这是一个辅助函数，用于在后台任务中提取文件内容并生成向量
    pub async fn generate_embedding_with_content(
        embedding_service: &EmbeddingService,
        storage: &Arc<dyn StorageBackend>,
        file: &File,
        mime_type: &str,
        original_filename: &str,
        file_id: Uuid,
        user_id: Uuid,
        pool: PgPool,
    ) {
        // 1. 读取文件内容
        let file_data = match storage.get_file(&file.file_path).await {
            Ok(data) => data,
            Err(e) => {
                tracing::warn!(
                    "Failed to read file {} for content extraction: {}",
                    file_id,
                    e
                );
                return;
            }
        };

        // 2. 提取文本内容
        let content =
            match FileContentExtractor::extract_text(&file_data, mime_type, original_filename) {
                Ok(text) => {
                    if text.trim().is_empty() {
                        tracing::debug!("No text content extracted from file {}", file_id);
                        // 即使没有内容，也使用文件名生成向量
                        format!("文件名: {}", original_filename)
                    } else {
                        text
                    }
                }
                Err(e) => {
                    tracing::warn!("Failed to extract content from file {}: {}", file_id, e);
                    // 提取失败时，至少使用文件名
                    format!("文件名: {}", original_filename)
                }
            };

        // 3. 组合文件名和内容用于生成向量
        let search_text = FileContentExtractor::combine_for_embedding(original_filename, &content);

        // 4. 生成向量嵌入
        match embedding_service.generate_embedding(&search_text).await {
            Ok(embedding) => {
                use crate::services::file::SemanticSearchService;
                let search_service = SemanticSearchService::new(pool);
                if let Err(e) = search_service
                    .update_file_embedding(file_id, user_id, &embedding)
                    .await
                {
                    tracing::warn!("Failed to update file embedding for {}: {}", file_id, e);
                } else {
                    tracing::debug!(
                        "Successfully generated embedding for file {} (with content)",
                        file_id
                    );
                }
            }
            Err(e) => {
                tracing::warn!("Failed to generate embedding for file {}: {}", file_id, e);
            }
        }
    }
}
