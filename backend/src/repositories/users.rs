//! users 表相关查询

use sqlx::PgPool;
use uuid::Uuid;

use crate::utils::AppError;

pub struct UsersRepo<'a> {
    pool: &'a PgPool,
}

impl<'a> UsersRepo<'a> {
    pub fn new(pool: &'a PgPool) -> Self {
        Self { pool }
    }

    pub async fn get_storage_quota(&self, user_id: Uuid) -> Result<Option<i64>, AppError> {
        let result: Option<(Option<i64>,)> =
            sqlx::query_as("SELECT storage_quota FROM users WHERE id = $1")
                .bind(user_id)
                .fetch_optional(self.pool)
                .await?;

        Ok(result.and_then(|(quota,)| quota))
    }
}
