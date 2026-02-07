//! 删除相关（单文件删除 / 批量删除）

use uuid::Uuid;

use crate::utils::AppError;

use super::FileService;

impl FileService {
    pub async fn delete_file(&self, file_id: Uuid, user_id: Uuid) -> Result<(), AppError> {
        let file = self.get_file(file_id, user_id).await?;
        let file_path = file.file_path.clone();
        // 秒传复用同一 file_path，仅当无其他记录引用该路径时才删物理文件
        let ref_count = self.files_repo.count_by_file_path(&file_path).await?;
        let _ = self.delete_thumbnail(file_id, user_id).await;
        let _ = self.delete_hls(file_id).await;
        self.files_repo.delete(file_id, user_id).await?;
        if ref_count <= 1 {
            let _ = self.storage.delete_file(&file_path).await;
        }
        Ok(())
    }

    pub async fn batch_delete(&self, ids: &[Uuid], user_id: Uuid) -> Result<u64, AppError> {
        let rows = self.files_repo.find_paths_by_ids(user_id, ids).await?;
        let mut deleted_ids: Vec<Uuid> = Vec::with_capacity(rows.len());
        let unique_paths: std::collections::HashSet<String> =
            rows.iter().map(|(_, p)| p.clone()).collect();

        for (id, _) in &rows {
            let _ = self.delete_thumbnail(*id, user_id).await;
            let _ = self.delete_hls(*id).await;
            deleted_ids.push(*id);
        }

        let affected = self.files_repo.delete_batch(&deleted_ids, user_id).await?;

        for file_path in unique_paths {
            let ref_count = self.files_repo.count_by_file_path(&file_path).await?;
            if ref_count == 0 {
                let _ = self.storage.delete_file(&file_path).await;
            }
        }

        Ok(affected)
    }
}
