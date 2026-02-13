//! # API Token 数据访问层
//!
//! 提供 API Token 表的所有数据库操作。

use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::api_token::{ApiToken, ApiTokenListItem};
use crate::utils::AppError;

// 确保 ApiToken 被导入用于查询

/// API Token 仓库
pub struct ApiTokensRepo<'a> {
    pool: &'a PgPool,
}

impl<'a> ApiTokensRepo<'a> {
    pub fn new(pool: &'a PgPool) -> Self {
        Self { pool }
    }

    // ========================================================================
    // 查询方法
    // ========================================================================

    /// 根据 token hash 获取 API Token
    pub async fn find_by_token_hash(&self, token_hash: &str) -> Result<Option<ApiToken>, AppError> {
        sqlx::query_as::<_, ApiToken>("SELECT * FROM api_tokens WHERE token_hash = $1")
            .bind(token_hash)
            .fetch_optional(self.pool)
            .await
            .map_err(AppError::from)
    }

    /// 列出用户的所有 API Token（不含 hash）
    pub async fn list_by_user(&self, user_id: Uuid) -> Result<Vec<ApiTokenListItem>, AppError> {
        let tokens = sqlx::query_as::<_, ApiToken>(
            "SELECT * FROM api_tokens WHERE user_id = $1 ORDER BY created_at DESC",
        )
        .bind(user_id)
        .fetch_all(self.pool)
        .await
        .map_err(AppError::from)?;

        Ok(tokens.into_iter().map(ApiTokenListItem::from).collect())
    }

    // ========================================================================
    // 写入方法
    // ========================================================================

    /// 创建 API Token
    pub async fn create(
        &self,
        user_id: Uuid,
        name: &str,
        token_hash: &str,
        token_prefix: &str,
        expires_at: Option<DateTime<Utc>>,
    ) -> Result<ApiToken, AppError> {
        sqlx::query_as::<_, ApiToken>(
            r#"
            INSERT INTO api_tokens (user_id, name, token_hash, token_prefix, expires_at)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
            "#,
        )
        .bind(user_id)
        .bind(name)
        .bind(token_hash)
        .bind(token_prefix)
        .bind(expires_at)
        .fetch_one(self.pool)
        .await
        .map_err(AppError::from)
    }

    /// 更新最后使用时间
    pub async fn update_last_used(&self, token_id: Uuid) -> Result<(), AppError> {
        sqlx::query("UPDATE api_tokens SET last_used_at = CURRENT_TIMESTAMP WHERE id = $1")
            .bind(token_id)
            .execute(self.pool)
            .await?;
        Ok(())
    }

    /// 删除 API Token
    pub async fn delete(&self, token_id: Uuid, user_id: Uuid) -> Result<u64, AppError> {
        let result = sqlx::query("DELETE FROM api_tokens WHERE id = $1 AND user_id = $2")
            .bind(token_id)
            .bind(user_id)
            .execute(self.pool)
            .await?;
        Ok(result.rows_affected())
    }
}
