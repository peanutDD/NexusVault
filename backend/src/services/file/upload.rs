//! 上传相关（普通上传 / 从本地路径上传）

use std::path::Path;

use uuid::Uuid;

use crate::models::file::FileResponse;
use crate::utils::AppError;

use super::FileService;

pub(crate) fn build_storage_filename(file_id: Uuid, original_filename: &str) -> Result<String, AppError> {
    let sanitized_filename = crate::utils::validation::sanitize_filename(original_filename)?;
    Ok(format!("{}_{}", file_id, sanitized_filename))
}

impl FileService {
    /// 从内存数据创建文件（暂未使用，保留以备将来 API 扩展）
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
    pub async fn create_file_from_path(
        &self,
        user_id: Uuid,
        original_filename: String,
        mime_type: String,
        file_size: u64,
        source_path: &Path,
        content_sha256: Option<&str>,
    ) -> Result<FileResponse, AppError> {
        self.ensure_can_store_detailed(user_id, &mime_type, file_size)
            .await?;

        let file_id = Uuid::new_v4();
        let storage_filename = build_storage_filename(file_id, &original_filename)?;

        // Save file to storage without loading into memory
        let file_path = self
            .storage
            .save_file_from_path(user_id, file_id, &storage_filename, source_path)
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
                content_sha256,
                None,
            )
            .await
            .map(FileResponse::from);

        // 若落库失败，尽量清理已写入的存储文件（此时 source_path 可能已被 move/删除）
        if inserted.is_err() {
            let _ = self.storage.delete_file(&file_path).await;
        }

        inserted
    }
}
