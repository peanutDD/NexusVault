//! # 分享数据访问层
//!
//! 提供文件分享表的所有数据库操作。

use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::share::FileShare;
use crate::utils::AppError;

/// 分享仓库
pub struct SharesRepo<'a> {
    pool: &'a PgPool,
}

impl<'a> SharesRepo<'a> {
    pub fn new(pool: &'a PgPool) -> Self {
        Self { pool }
    }

    // ========================================================================
    // 查询方法
    // ========================================================================

    /// 根据分享 token 获取分享信息
    pub async fn find_by_token(&self, share_token: &str) -> Result<Option<FileShare>, AppError> {
        sqlx::query_as::<_, FileShare>("SELECT * FROM file_shares WHERE share_token = $1")
            .bind(share_token)
            .fetch_optional(self.pool)
            .await
            .map_err(AppError::from)
    }

    /// 根据文件 ID 和用户 ID 获取分享信息
    pub async fn find_by_file_and_user(
        &self,
        file_id: Uuid,
        user_id: Uuid,
    ) -> Result<Option<FileShare>, AppError> {
        sqlx::query_as::<_, FileShare>(
            "SELECT * FROM file_shares WHERE file_id = $1 AND user_id = $2",
        )
        .bind(file_id)
        .bind(user_id)
        .fetch_optional(self.pool)
        .await
        .map_err(AppError::from)
    }

    /// 列出用户的所有分享
    pub async fn list_by_user(&self, user_id: Uuid) -> Result<Vec<FileShare>, AppError> {
        sqlx::query_as::<_, FileShare>(
            "SELECT * FROM file_shares WHERE user_id = $1 ORDER BY created_at DESC",
        )
        .bind(user_id)
        .fetch_all(self.pool)
        .await
        .map_err(AppError::from)
    }

    // ========================================================================
    // 写入方法
    // ========================================================================

    /// 创建分享
    pub async fn create(
        &self,
        file_id: Uuid,
        user_id: Uuid,
        share_token: &str,
        password_hash: Option<&str>,
        expires_at: Option<DateTime<Utc>>,
        max_downloads: Option<i32>,
    ) -> Result<FileShare, AppError> {
        sqlx::query_as::<_, FileShare>(
            r#"
            INSERT INTO file_shares (file_id, user_id, share_token, password_hash, expires_at, max_downloads)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
            "#,
        )
        .bind(file_id)
        .bind(user_id)
        .bind(share_token)
        .bind(password_hash)
        .bind(expires_at)
        .bind(max_downloads)
        .fetch_one(self.pool)
        .await
        .map_err(AppError::from)
    }

    /// 增加下载计数
    pub async fn increment_download_count(&self, share_id: Uuid) -> Result<(), AppError> {
        sqlx::query(
            "UPDATE file_shares SET download_count = download_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = $1",
        )
        .bind(share_id)
        .execute(self.pool)
        .await?;
        Ok(())
    }

    /// 删除分享
    pub async fn delete(&self, file_id: Uuid, user_id: Uuid) -> Result<u64, AppError> {
        let result = sqlx::query("DELETE FROM file_shares WHERE file_id = $1 AND user_id = $2")
            .bind(file_id)
            .bind(user_id)
            .execute(self.pool)
            .await?;
        Ok(result.rows_affected())
    }

    /// 根据 ID 删除分享
    pub async fn delete_by_id(&self, share_id: Uuid) -> Result<u64, AppError> {
        let result = sqlx::query("DELETE FROM file_shares WHERE id = $1")
            .bind(share_id)
            .execute(self.pool)
            .await?;
        Ok(result.rows_affected())
    }
}
