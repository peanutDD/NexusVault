//! 分类相关（分类列表 / 批量移动分类）

use chrono::Utc;
use uuid::Uuid;

use crate::models::file::BatchMoveRequest;
use crate::utils::AppError;

use super::FileService;

impl FileService {
    /// List distinct categories for a user (excluding null/empty).
    pub async fn list_categories(&self, user_id: Uuid) -> Result<Vec<String>, AppError> {
        let rows = sqlx::query_scalar::<_, String>(
            "SELECT DISTINCT category FROM files WHERE user_id = $1 AND category IS NOT NULL AND TRIM(category) != '' ORDER BY category",
        )
        .bind(user_id)
        .fetch_all(&self.pool)
        .await?;

        Ok(rows)
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

        let result = sqlx::query(
            "UPDATE files SET category = $1, updated_at = $2 WHERE user_id = $3 AND id = ANY($4)",
        )
        .bind(&category_value)
        .bind(Utc::now())
        .bind(user_id)
        .bind(&req.ids)
        .execute(&self.pool)
        .await?;

        Ok(result.rows_affected())
    }
}

