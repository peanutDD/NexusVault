//! # API Token 服务模块
//!
//! 提供 API Token 的管理功能。

use chrono::{Duration, Utc};
use sha2::{Digest, Sha256};
use sqlx::PgPool;
use uuid::Uuid;

use crate::{
    constants::API_TOKEN_CHARSET,
    models::api_token::{ApiToken, ApiTokenListItem, CreateApiTokenRequest},
    repositories::ApiTokensRepo,
    utils::AppError,
};

pub struct ApiTokenService {
    pool: PgPool,
}

impl ApiTokenService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// 从 AppState 创建 ApiTokenService（工厂方法）
    pub fn from_state(state: &crate::AppState) -> Self {
        Self::new(state.pool.clone())
    }

    /// 生成安全的随机 token
    fn generate_token() -> String {
        use rand::Rng;
        let mut rng = rand::thread_rng();
        (0..64)
            .map(|_| {
                let idx = rng.gen_range(0..API_TOKEN_CHARSET.len());
                API_TOKEN_CHARSET[idx] as char
            })
            .collect()
    }

    /// 使用 SHA-256 哈希 token
    fn hash_token(token: &str) -> String {
        let mut hasher = Sha256::new();
        hasher.update(token.as_bytes());
        format!("{:x}", hasher.finalize())
    }

    /// 获取 token 前缀（用于显示）
    fn get_token_prefix(token: &str) -> String {
        token.chars().take(8).collect()
    }

    /// 创建新的 API token
    pub async fn create_token(
        &self,
        user_id: Uuid,
        req: CreateApiTokenRequest,
    ) -> Result<(String, ApiToken), AppError> {
        let repo = ApiTokensRepo::new(&self.pool);

        // 生成 token（只显示一次）
        let token = Self::generate_token();
        let token_hash = Self::hash_token(&token);
        let token_prefix = Self::get_token_prefix(&token);

        // 计算过期时间
        let expires_at = req
            .expires_in_days
            .map(|days| Utc::now() + Duration::days(days as i64));

        // 创建 token
        let api_token = repo
            .create(user_id, &req.name, &token_hash, &token_prefix, expires_at)
            .await?;

        Ok((token, api_token))
    }

    /// 验证 token 并返回用户 ID
    pub async fn verify_token(&self, token: &str) -> Result<Uuid, AppError> {
        let repo = ApiTokensRepo::new(&self.pool);
        let token_hash = Self::hash_token(token);

        let api_token = repo
            .find_by_token_hash(&token_hash)
            .await?
            .ok_or(AppError::Unauthorized)?;

        // 检查是否过期
        if let Some(exp) = api_token.expires_at {
            if exp < Utc::now() {
                return Err(AppError::Unauthorized);
            }
        }

        // 更新最后使用时间
        repo.update_last_used(api_token.id).await?;

        Ok(api_token.user_id)
    }

    /// 列出用户的所有 API token
    pub async fn list_tokens(&self, user_id: Uuid) -> Result<Vec<ApiTokenListItem>, AppError> {
        let repo = ApiTokensRepo::new(&self.pool);
        repo.list_by_user(user_id).await
    }

    /// 删除 API token
    pub async fn delete_token(&self, token_id: Uuid, user_id: Uuid) -> Result<(), AppError> {
        let repo = ApiTokensRepo::new(&self.pool);

        let affected = repo.delete(token_id, user_id).await?;

        if affected == 0 {
            return Err(AppError::NotFound);
        }

        Ok(())
    }
}
