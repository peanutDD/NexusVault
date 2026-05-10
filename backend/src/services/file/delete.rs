//! 删除相关（软删除 / 回收站 / 彻底删除）

use std::collections::HashSet;

use futures::StreamExt;

use crate::models::file::{BatchTrashFailure, BatchTrashResult, FileResponse};
use uuid::Uuid;

use crate::utils::AppError;

use super::FileService;

impl FileService {
    pub async fn delete_file(&self, file_id: Uuid, user_id: Uuid) -> Result<(), AppError> {
        self.get_file(file_id, user_id).await?;
        let affected = self.files_repo.soft_delete(file_id, user_id).await?;
        if affected == 0 {
            return Err(AppError::NotFound);
        }
        Ok(())
    }

    pub async fn batch_delete(&self, ids: &[Uuid], user_id: Uuid) -> Result<u64, AppError> {
        self.files_repo.soft_delete_batch(ids, user_id).await
    }

    pub async fn list_trash(&self, user_id: Uuid) -> Result<Vec<FileResponse>, AppError> {
        let files = self.files_repo.list_deleted(user_id).await?;
        Ok(files.into_iter().map(FileResponse::from).collect())
    }

    pub async fn restore_file(
        &self,
        file_id: Uuid,
        user_id: Uuid,
    ) -> Result<FileResponse, AppError> {
        let file = self
            .files_repo
            .find_deleted_by_id(file_id, user_id)
            .await?
            .ok_or(AppError::NotFound)?;

        if let Some(conflict) = self
            .files_repo
            .find_by_name_and_folder(user_id, &file.original_filename, file.folder_id)
            .await?
        {
            if conflict.id != file_id {
                return Err(AppError::Validation("同名文件已存在".to_string()));
            }
        }

        let restored = self.files_repo.restore_deleted(file_id, user_id).await?;
        Ok(FileResponse::from(restored))
    }

    pub async fn batch_restore_files(
        &self,
        ids: &[Uuid],
        user_id: Uuid,
    ) -> Result<BatchTrashResult, AppError> {
        let mut succeeded = 0;
        let mut failed = Vec::new();

        for id in ids {
            match self.restore_file(*id, user_id).await {
                Ok(_) => succeeded += 1,
                Err(error) => failed.push(BatchTrashFailure {
                    id: *id,
                    message: error.to_string(),
                }),
            }
        }

        Ok(BatchTrashResult { succeeded, failed })
    }

    pub async fn permanently_delete_file(
        &self,
        file_id: Uuid,
        user_id: Uuid,
    ) -> Result<(), AppError> {
        let file = self
            .files_repo
            .find_deleted_by_id(file_id, user_id)
            .await?
            .ok_or(AppError::NotFound)?;
        let affected = self
            .files_repo
            .hard_delete_deleted(file_id, user_id)
            .await?;
        if affected == 0 {
            return Err(AppError::NotFound);
        }
        self.cleanup_unreferenced_deleted_files(vec![file]).await?;
        Ok(())
    }

    pub async fn batch_permanently_delete_files(
        &self,
        ids: &[Uuid],
        user_id: Uuid,
    ) -> Result<BatchTrashResult, AppError> {
        let files = self
            .files_repo
            .hard_delete_deleted_batch(ids, user_id)
            .await?;
        let deleted_ids: HashSet<Uuid> = files.iter().map(|file| file.id).collect();
        let failed = ids
            .iter()
            .filter(|id| !deleted_ids.contains(id))
            .map(|id| BatchTrashFailure {
                id: *id,
                message: AppError::NotFound.to_string(),
            })
            .collect();
        let succeeded = files.len() as u64;

        self.cleanup_unreferenced_deleted_files(files).await?;

        Ok(BatchTrashResult { succeeded, failed })
    }

    pub async fn empty_trash(&self, user_id: Uuid) -> Result<u64, AppError> {
        let files = self.files_repo.hard_delete_all_deleted(user_id).await?;
        let deleted = files.len() as u64;
        self.cleanup_unreferenced_deleted_files(files).await?;
        Ok(deleted)
    }

    pub async fn purge_expired_trash(
        &self,
        retention_days: i64,
        batch_limit: i64,
    ) -> Result<u64, AppError> {
        let files = self
            .files_repo
            .purge_expired_deleted(retention_days, batch_limit)
            .await?;
        let deleted = files.len() as u64;
        self.cleanup_unreferenced_deleted_files(files).await?;
        Ok(deleted)
    }

    async fn cleanup_unreferenced_deleted_files(
        &self,
        files: Vec<crate::entities::file::File>,
    ) -> Result<(), AppError> {
        let paths: Vec<String> = files
            .iter()
            .map(|file| file.file_path.clone())
            .collect::<HashSet<_>>()
            .into_iter()
            .collect();
        let ref_counts = self.files_repo.count_by_file_paths(&paths).await?;

        futures::stream::iter(files.iter())
            .map(|file| self.delete_derived_assets(file.id, file.user_id))
            .buffer_unordered(10)
            .for_each(|_| async {})
            .await;

        futures::stream::iter(paths.into_iter())
            .filter(|path| {
                let path = path.clone();
                let ref_counts = &ref_counts;
                async move { ref_counts.get(&path).copied().unwrap_or(0) == 0 }
            })
            .for_each_concurrent(10, |path| async move {
                let _ = self.storage.delete_file(&path).await;
            })
            .await;
        Ok(())
    }

    async fn delete_derived_assets(&self, file_id: Uuid, user_id: Uuid) {
        let _ = self.delete_thumbnail(file_id, user_id).await;
        let _ = self.delete_hls(file_id).await;
        let _ = self.delete_gif_preview_video(file_id).await;
    }
}
