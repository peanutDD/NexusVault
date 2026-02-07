//! 删除相关（单文件删除 / 批量删除）

use uuid::Uuid;

use crate::utils::AppError;

use super::FileService;

impl FileService {
    pub async fn delete_file(&self, file_id: Uuid, user_id: Uuid) -> Result<(), AppError> {
        let file = self.get_file(file_id, user_id).await?;
        self.storage.delete_file(&file.file_path).await?;
        let _ = self.delete_thumbnail(file_id).await;
        let _ = self.delete_hls(file_id).await;
        self.files_repo.delete(file_id, user_id).await?;
        Ok(())
    }

    pub async fn batch_delete(&self, ids: &[Uuid], user_id: Uuid) -> Result<u64, AppError> {
        // 先一次性查出要删除的 file_path，避免 N+1 查询
        let rows = self.files_repo.find_paths_by_ids(user_id, ids).await?;

        let mut deleted_ids: Vec<Uuid> = Vec::with_capacity(rows.len());

        for (id, file_path) in rows {
            // 先删存储，避免 DB 先删导致"记录没了但文件还在"的不可逆状态
            if let Err(e) = self.storage.delete_file(&file_path).await {
                // 尽量把已成功删除存储的记录一次性从 DB 清理掉，避免残留"孤儿记录"
                let _ = self.files_repo.delete_batch(&deleted_ids, user_id).await;
                return Err(e);
            }
            let _ = self.delete_thumbnail(id).await;
            let _ = self.delete_hls(id).await;
            deleted_ids.push(id);
        }

        let affected = self.files_repo.delete_batch(&deleted_ids, user_id).await?;
        Ok(affected)
    }
}
