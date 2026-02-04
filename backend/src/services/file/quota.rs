//! 存储用量与配额

use uuid::Uuid;

use crate::utils::AppError;

use super::FileService;

impl FileService {
    pub async fn get_storage_usage(&self, user_id: Uuid) -> Result<(i64, u64), AppError> {
        self.files_repo.get_storage_usage(user_id).await
    }

    pub async fn get_storage_quota(&self, user_id: Uuid) -> Result<Option<i64>, AppError> {
        self.users_repo.get_storage_quota(user_id).await
    }
}
