use crate::{
    models::api_token::{ApiToken, ApiTokenListItem, CreateApiTokenRequest},
    utils::AppError,
};
use chrono::{Duration, Utc};
use sha2::{Digest, Sha256};
use sqlx::PgPool;
use uuid::Uuid;

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

    /// Generate a secure random token
    fn generate_token() -> String {
        use rand::Rng;
        const CHARSET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        let mut rng = rand::thread_rng();
        (0..64)
            .map(|_| {
                let idx = rng.gen_range(0..CHARSET.len());
                CHARSET[idx] as char
            })
            .collect()
    }

    /// Hash a token using SHA-256
    fn hash_token(token: &str) -> String {
        let mut hasher = Sha256::new();
        hasher.update(token.as_bytes());
        format!("{:x}", hasher.finalize())
    }

    /// Create a new API token
    pub async fn create_token(
        &self,
        user_id: Uuid,
        req: CreateApiTokenRequest,
    ) -> Result<(String, ApiToken), AppError> {
        // Generate token (only shown once)
        let token = Self::generate_token();
        let token_hash = Self::hash_token(&token);

        // Calculate expiration
        let expires_at = req
            .expires_in_days
            .map(|days| Utc::now() + Duration::days(days as i64));

        // Insert into database
        let api_token = sqlx::query_as::<_, ApiToken>(
            r#"
            INSERT INTO api_tokens (user_id, token_hash, name, expires_at)
            VALUES ($1, $2, $3, $4)
            RETURNING *
            "#,
        )
        .bind(user_id)
        .bind(&token_hash)
        .bind(&req.name)
        .bind(expires_at)
        .fetch_one(&self.pool)
        .await?;

        Ok((token, api_token))
    }

    /// Verify and get user_id from token
    pub async fn verify_token(&self, token: &str) -> Result<Uuid, AppError> {
        let token_hash = Self::hash_token(token);

        let result: Option<(Uuid, Option<chrono::DateTime<Utc>>)> = sqlx::query_as(
            r#"
            SELECT user_id, expires_at
            FROM api_tokens
            WHERE token_hash = $1
            "#,
        )
        .bind(&token_hash)
        .fetch_optional(&self.pool)
        .await?;

        let (user_id, expires_at) = result.ok_or(AppError::Unauthorized)?;

        // Check expiration
        if let Some(exp) = expires_at {
            if exp < Utc::now() {
                return Err(AppError::Unauthorized);
            }
        }

        // Update last_used_at
        sqlx::query(
            r#"
            UPDATE api_tokens
            SET last_used_at = $1, updated_at = $1
            WHERE token_hash = $2
            "#,
        )
        .bind(Utc::now())
        .bind(&token_hash)
        .execute(&self.pool)
        .await?;

        Ok(user_id)
    }

    /// List all API tokens for a user
    pub async fn list_tokens(&self, user_id: Uuid) -> Result<Vec<ApiTokenListItem>, AppError> {
        let tokens = sqlx::query_as::<_, ApiToken>(
            r#"
            SELECT * FROM api_tokens
            WHERE user_id = $1
            ORDER BY created_at DESC
            "#,
        )
        .bind(user_id)
        .fetch_all(&self.pool)
        .await?;

        Ok(tokens.into_iter().map(ApiTokenListItem::from).collect())
    }

    /// Delete an API token
    pub async fn delete_token(&self, token_id: Uuid, user_id: Uuid) -> Result<(), AppError> {
        let result = sqlx::query(
            r#"
            DELETE FROM api_tokens
            WHERE id = $1 AND user_id = $2
            "#,
        )
        .bind(token_id)
        .bind(user_id)
        .execute(&self.pool)
        .await?;

        if result.rows_affected() == 0 {
            return Err(AppError::NotFound);
        }

        Ok(())
    }
}
