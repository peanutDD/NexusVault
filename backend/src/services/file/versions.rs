//! 文件版本管理相关

use uuid::Uuid;

use crate::models::file::{FileVersionResponse, RestoreVersionRequest, UpdateVersionLabelRequest};
use crate::utils::AppError;

use super::FileService;

impl FileService {
    /// 获取文件的所有版本列表
    pub async fn list_file_versions(
        &self,
        file_id: Uuid,
        user_id: Uuid,
    ) -> Result<Vec<FileVersionResponse>, AppError> {
        // 先验证文件归属
        self.files_repo
            .find_by_id(file_id, user_id)
            .await?
            .ok_or(AppError::NotFound)?;

        let versions = self
            .file_versions_repo
            .list_versions(file_id, user_id)
            .await?;
        Ok(versions
            .into_iter()
            .map(FileVersionResponse::from)
            .collect())
    }

    /// 获取指定版本详情
    pub async fn get_file_version(
        &self,
        version_id: Uuid,
        user_id: Uuid,
    ) -> Result<FileVersionResponse, AppError> {
        let version = self
            .file_versions_repo
            .get_version(version_id, user_id)
            .await?
            .ok_or(AppError::NotFound)?;
        Ok(FileVersionResponse::from(version))
    }

    /// 更新版本标签
    pub async fn update_version_label(
        &self,
        version_id: Uuid,
        user_id: Uuid,
        req: UpdateVersionLabelRequest,
    ) -> Result<(), AppError> {
        self.file_versions_repo
            .update_label(version_id, user_id, req.label.as_deref())
            .await
    }

    /// 恢复版本（将历史版本恢复为当前版本）
    pub async fn restore_version(
        &self,
        file_id: Uuid,
        version_id: Uuid,
        user_id: Uuid,
        req: RestoreVersionRequest,
    ) -> Result<(), AppError> {
        // 验证文件归属
        let current_file = self
            .files_repo
            .find_by_id(file_id, user_id)
            .await?
            .ok_or(AppError::NotFound)?;

        // 获取要恢复的版本
        let version = self
            .file_versions_repo
            .get_version(version_id, user_id)
            .await?
            .ok_or(AppError::NotFound)?;

        // 验证版本属于该文件
        if version.file_id != file_id {
            return Err(AppError::Validation("版本不属于该文件".to_string()));
        }

        // 如果需要保留当前版本，将当前文件保存为历史版本
        if req.keep_current {
            let max_version = self
                .file_versions_repo
                .get_max_version_number(file_id)
                .await?;
            let _ = self
                .file_versions_repo
                .create_version(
                    file_id,
                    user_id,
                    max_version + 1,
                    &current_file.filename,
                    &current_file.original_filename,
                    &current_file.file_path,
                    current_file.file_size as u64,
                    &current_file.mime_type,
                    &current_file.storage_backend,
                    current_file.content_sha256.as_deref(),
                )
                .await;
        }

        // 将版本文件复制回当前文件位置
        let version_data = self.storage.get_file(&version.file_path).await?;
        let new_storage_filename =
            super::upload::build_storage_filename(file_id, &version.original_filename)?;
        let new_file_path = self
            .storage
            .save_file(user_id, file_id, &new_storage_filename, &version_data)
            .await?;

        // 更新文件记录
        sqlx::query(
            "UPDATE files SET 
                filename = $1, file_path = $2, file_size = $3, mime_type = $4,
                content_sha256 = $5, updated_at = CURRENT_TIMESTAMP
             WHERE id = $6 AND user_id = $7",
        )
        .bind(&new_storage_filename)
        .bind(&new_file_path)
        .bind(version.file_size)
        .bind(&version.mime_type)
        .bind(&version.content_sha256)
        .bind(file_id)
        .bind(user_id)
        .execute(&self.pool)
        .await?;

        // 清理旧版本（只保留最近2个）
        let old_version_paths = self
            .file_versions_repo
            .cleanup_old_versions(file_id, 2)
            .await?;
        for old_path in old_version_paths {
            let _ = self.storage.delete_file(&old_path).await;
        }

        Ok(())
    }

    /// 删除指定版本
    pub async fn delete_version(&self, version_id: Uuid, user_id: Uuid) -> Result<(), AppError> {
        let file_path = self
            .file_versions_repo
            .delete_version(version_id, user_id)
            .await?;
        let _ = self.storage.delete_file(&file_path).await;
        Ok(())
    }
}
