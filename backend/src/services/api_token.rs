//! # API Token 服务模块
//!
//! 提供 API Token 的管理功能。
//!
//! ## 安全特性
//!
//! - 使用 HMAC-SHA256 加盐哈希，防止彩虹表攻击
//! - Token 只在创建时返回一次，数据库仅存储哈希值

use chrono::{Duration, Utc};
use hmac::{Hmac, Mac};
use sha2::Sha256;
use sqlx::PgPool;
use uuid::Uuid;

use crate::{
    constants::API_TOKEN_CHARSET,
    models::api_token::{ApiToken, ApiTokenListItem, CreateApiTokenRequest},
    repositories::ApiTokensRepo,
    utils::AppError,
};

type HmacSha256 = Hmac<Sha256>;

pub struct ApiTokenService {
    pool: PgPool,
    secrets: Vec<String>,
}

impl ApiTokenService {
    pub fn new(pool: PgPool, secrets: Vec<String>) -> Self {
        Self { pool, secrets }
    }

    /// 从 AppState 创建 ApiTokenService（工厂方法）
    pub fn from_state(state: &crate::AppState) -> Self {
        Self::new(state.pool.clone(), state.config.api_token_hmac_secrets())
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

    /// 使用 HMAC-SHA256 加盐哈希 token
    ///
    /// 使用服务器密钥作为盐值，防止彩虹表攻击。secret 为空时返回错误，避免 panic。
    fn hash_token_with(secret: &str, token: &str) -> Result<String, AppError> {
        if secret.trim().is_empty() {
            return Err(AppError::Internal);
        }
        let mut mac =
            HmacSha256::new_from_slice(secret.as_bytes()).map_err(|_| AppError::Internal)?;
        mac.update(token.as_bytes());
        let result = mac.finalize();
        Ok(format!("{:x}", result.into_bytes()))
    }

    fn hash_token(&self, token: &str) -> Result<String, AppError> {
        let Some(secret) = self.secrets.first() else {
            return Err(AppError::Internal);
        };
        Self::hash_token_with(secret, token)
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
        let token_hash = self.hash_token(&token)?;
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
        for secret in self.secrets.iter() {
            let token_hash = Self::hash_token_with(secret, token)?;
            if let Some(api_token) = repo.find_by_token_hash(&token_hash).await? {
                if let Some(exp) = api_token.expires_at {
                    if exp < Utc::now() {
                        return Err(AppError::Unauthorized);
                    }
                }
                repo.update_last_used(api_token.id).await?;
                return Ok(api_token.user_id);
            }
        }

        Err(AppError::Unauthorized)
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
