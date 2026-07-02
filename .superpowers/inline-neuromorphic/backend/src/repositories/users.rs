//! # 用户数据访问层 - SQLx 实现
//!
//! 提供 `UsersRepository` trait 的 PostgreSQL/SQLx 实现。

use async_trait::async_trait;
use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::user::User;
use crate::repositories::traits::UsersRepository;
use crate::utils::AppError;

/// SQLx 实现的用户仓库
///
/// 持有 `PgPool` 句柄（克隆开销极低），通过 `Arc<dyn UsersRepository>` 注入到 Service。
pub struct SqlxUsersRepo {
    pool: PgPool,
}

impl SqlxUsersRepo {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl UsersRepository for SqlxUsersRepo {
    async fn find_by_id(&self, user_id: Uuid) -> Result<Option<User>, AppError> {
        sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1")
            .bind(user_id)
            .fetch_optional(&self.pool)
            .await
            .map_err(AppError::from)
    }

    async fn find_by_email(&self, email: &str) -> Result<Option<User>, AppError> {
        sqlx::query_as::<_, User>("SELECT * FROM users WHERE email = $1")
            .bind(email)
            .fetch_optional(&self.pool)
            .await
            .map_err(AppError::from)
    }

    async fn find_by_username(&self, username: &str) -> Result<Option<User>, AppError> {
        sqlx::query_as::<_, User>("SELECT * FROM users WHERE username = $1")
            .bind(username)
            .fetch_optional(&self.pool)
            .await
            .map_err(AppError::from)
    }

    async fn exists_by_email_or_username(
        &self,
        email: &str,
        username: &str,
    ) -> Result<bool, AppError> {
        let result: Option<(Uuid,)> =
            sqlx::query_as("SELECT id FROM users WHERE email = $1 OR username = $2")
                .bind(email)
                .bind(username)
                .fetch_optional(&self.pool)
                .await?;
        Ok(result.is_some())
    }

    async fn exists_by_email_or_username_excluding(
        &self,
        exclude_user_id: Uuid,
        email: &str,
        username: &str,
    ) -> Result<bool, AppError> {
        let result: Option<(Uuid,)> =
            sqlx::query_as("SELECT id FROM users WHERE id != $1 AND (email = $2 OR username = $3)")
                .bind(exclude_user_id)
                .bind(email)
                .bind(username)
                .fetch_optional(&self.pool)
                .await?;
        Ok(result.is_some())
    }

    async fn update_profile(
        &self,
        user_id: Uuid,
        username: &str,
        email: &str,
        updated_at: DateTime<Utc>,
    ) -> Result<(), AppError> {
        sqlx::query("UPDATE users SET username = $1, email = $2, updated_at = $3 WHERE id = $4")
            .bind(username)
            .bind(email)
            .bind(updated_at)
            .bind(user_id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    async fn get_storage_quota(&self, user_id: Uuid) -> Result<Option<i64>, AppError> {
        let result: Option<(Option<i64>,)> =
            sqlx::query_as("SELECT storage_quota FROM users WHERE id = $1")
                .bind(user_id)
                .fetch_optional(&self.pool)
                .await?;
        Ok(result.and_then(|(quota,)| quota))
    }

    async fn create(
        &self,
        username: &str,
        email: &str,
        password_hash: &str,
    ) -> Result<User, AppError> {
        sqlx::query_as::<_, User>(
            "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING *",
        )
        .bind(username)
        .bind(email)
        .bind(password_hash)
        .fetch_one(&self.pool)
        .await
        .map_err(AppError::from)
    }

    async fn update_password(
        &self,
        user_id: Uuid,
        password_hash: &str,
        updated_at: DateTime<Utc>,
    ) -> Result<(), AppError> {
        sqlx::query("UPDATE users SET password_hash = $1, updated_at = $2 WHERE id = $3")
            .bind(password_hash)
            .bind(updated_at)
            .bind(user_id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }
}
