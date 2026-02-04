//! # 用户数据访问层
//!
//! 提供用户表的所有数据库操作。

use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::user::User;
use crate::utils::AppError;

/// 用户仓库
pub struct UsersRepo<'a> {
    pool: &'a PgPool,
}

impl<'a> UsersRepo<'a> {
    pub fn new(pool: &'a PgPool) -> Self {
        Self { pool }
    }

    // ========================================================================
    // 查询方法
    // ========================================================================

    /// 根据 ID 获取用户
    pub async fn find_by_id(&self, user_id: Uuid) -> Result<Option<User>, AppError> {
        sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1")
            .bind(user_id)
            .fetch_optional(self.pool)
            .await
            .map_err(AppError::from)
    }

    /// 根据邮箱获取用户
    pub async fn find_by_email(&self, email: &str) -> Result<Option<User>, AppError> {
        sqlx::query_as::<_, User>("SELECT * FROM users WHERE email = $1")
            .bind(email)
            .fetch_optional(self.pool)
            .await
            .map_err(AppError::from)
    }

    /// 根据用户名获取用户
    pub async fn find_by_username(&self, username: &str) -> Result<Option<User>, AppError> {
        sqlx::query_as::<_, User>("SELECT * FROM users WHERE username = $1")
            .bind(username)
            .fetch_optional(self.pool)
            .await
            .map_err(AppError::from)
    }

    /// 检查邮箱或用户名是否已存在
    pub async fn exists_by_email_or_username(
        &self,
        email: &str,
        username: &str,
    ) -> Result<bool, AppError> {
        let result: Option<(Uuid,)> =
            sqlx::query_as("SELECT id FROM users WHERE email = $1 OR username = $2")
                .bind(email)
                .bind(username)
                .fetch_optional(self.pool)
                .await?;
        Ok(result.is_some())
    }

    /// 获取用户存储配额
    pub async fn get_storage_quota(&self, user_id: Uuid) -> Result<Option<i64>, AppError> {
        let result: Option<(Option<i64>,)> =
            sqlx::query_as("SELECT storage_quota FROM users WHERE id = $1")
                .bind(user_id)
                .fetch_optional(self.pool)
                .await?;
        Ok(result.and_then(|(quota,)| quota))
    }

    // ========================================================================
    // 写入方法
    // ========================================================================

    /// 创建新用户
    pub async fn create(
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
        .fetch_one(self.pool)
        .await
        .map_err(AppError::from)
    }

    /// 更新用户密码
    pub async fn update_password(
        &self,
        user_id: Uuid,
        password_hash: &str,
        updated_at: DateTime<Utc>,
    ) -> Result<(), AppError> {
        sqlx::query("UPDATE users SET password_hash = $1, updated_at = $2 WHERE id = $3")
            .bind(password_hash)
            .bind(updated_at)
            .bind(user_id)
            .execute(self.pool)
            .await?;
        Ok(())
    }
}
