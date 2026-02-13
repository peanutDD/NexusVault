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

    /// 列出用户的所有分享。
    ///
    /// 当前对外 API 只暴露「创建分享 / 通过 token 访问单条分享」，
    /// 管理端「我的全部分享列表」页面尚未实现，因此该方法暂未被调用，
    /// 预留给将来做分享管理后台或个人中心时使用。
    #[allow(dead_code)]
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

    /// 删除分享。
    ///
    /// 目前主要通过 `delete_by_id` 在内部使用，按「file_id + user_id」
    /// 删除的接口未暴露给 HTTP 层，因此保持为未使用状态，后续若需要
    /// 直接按文件维度批量取消分享，可以复用此方法。
    #[allow(dead_code)]
    pub async fn delete(&self, file_id: Uuid, user_id: Uuid) -> Result<u64, AppError> {
        let result = sqlx::query("DELETE FROM file_shares WHERE file_id = $1 AND user_id = $2")
            .bind(file_id)
            .bind(user_id)
            .execute(self.pool)
            .await?;
        Ok(result.rows_affected())
    }

    /// 根据 ID 和 user_id 删除分享。
    ///
    /// 仅允许创建该分享的用户删除，避免任意已登录用户拿到 `share_id`
    /// 后删除他人分享链接的越权风险。
    pub async fn delete_by_id(&self, share_id: Uuid, user_id: Uuid) -> Result<u64, AppError> {
        let result = sqlx::query("DELETE FROM file_shares WHERE id = $1 AND user_id = $2")
            .bind(share_id)
            .bind(user_id)
            .execute(self.pool)
            .await?;
        Ok(result.rows_affected())
    }
}
