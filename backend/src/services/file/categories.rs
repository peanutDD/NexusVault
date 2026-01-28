//! 分类相关（分类列表 / 批量移动分类）

use chrono::Utc;
use uuid::Uuid;

use crate::models::file::BatchMoveRequest;
use crate::utils::AppError;

use super::FileService;

impl FileService {
    /// List distinct categories for a user (excluding null/empty).
    pub async fn list_categories(&self, user_id: Uuid) -> Result<Vec<String>, AppError> {
        crate::repositories::files::FilesRepo::new(&self.pool)
            .list_categories(user_id)
            .await
    }

    /// Batch move files to a category. Empty category = uncategorized (NULL).
    pub async fn batch_move(&self, user_id: Uuid, req: BatchMoveRequest) -> Result<u64, AppError> {
        let category_value: Option<String> = req.category.as_ref().and_then(|s| {
            let t = s.trim();
            if t.is_empty() {
                None
            } else {
                Some(t.to_string())
            }
        });

        crate::repositories::files::FilesRepo::new(&self.pool)
            .update_category(user_id, &req.ids, category_value.as_deref(), Utc::now())
            .await
    }
}
