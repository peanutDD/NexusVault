//! 删除相关（单文件删除 / 批量删除）

use uuid::Uuid;

use crate::utils::AppError;

use super::FileService;

impl FileService {
    pub async fn delete_file(&self, file_id: Uuid, user_id: Uuid) -> Result<(), AppError> {
        let file = self.get_file(file_id, user_id).await?;
        self.storage.delete_file(&file.file_path).await?;
        sqlx::query("DELETE FROM files WHERE id = $1 AND user_id = $2")
            .bind(file_id)
            .bind(user_id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn batch_delete(&self, ids: &[Uuid], user_id: Uuid) -> Result<u64, AppError> {
        let mut deleted = 0u64;
        for &id in ids {
            if let Ok(file) = self.get_file(id, user_id).await {
                self.storage.delete_file(&file.file_path).await?;
                sqlx::query("DELETE FROM files WHERE id = $1 AND user_id = $2")
                    .bind(id)
                    .bind(user_id)
                    .execute(&self.pool)
                    .await?;
                deleted += 1;
            }
        }
        Ok(deleted)
    }
}

