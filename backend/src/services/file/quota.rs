//! 存储用量与配额

use uuid::Uuid;

use crate::utils::AppError;

use super::FileService;

impl FileService {
    pub async fn get_storage_usage(&self, user_id: Uuid) -> Result<(i64, u64), AppError> {
        // Get total storage used and file count
        // CAST SUM to BIGINT because PostgreSQL SUM() returns NUMERIC
        let result: Option<(i64, i64)> = sqlx::query_as(
            "SELECT COALESCE(SUM(file_size)::BIGINT, 0), COUNT(*)::BIGINT FROM files WHERE user_id = $1",
        )
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await?;

        match result {
            Some((total_size, file_count)) => Ok((total_size, file_count as u64)),
            None => Ok((0, 0)),
        }
    }

    pub async fn get_storage_quota(&self, user_id: Uuid) -> Result<Option<i64>, AppError> {
        let result: Option<(Option<i64>,)> =
            sqlx::query_as("SELECT storage_quota FROM users WHERE id = $1")
                .bind(user_id)
                .fetch_optional(&self.pool)
                .await?;

        Ok(result.and_then(|(quota,)| quota))
    }
}

