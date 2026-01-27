use chrono::Utc;
use sqlx::PgPool;
use uuid::Uuid;

use crate::{
    models::share::{
        BatchShareRequest, BatchShareResponse, CreateShareRequest, FileShare, ShareResponse,
    },
    utils::{calculate_expiration, generate_random_token, hash_password, verify_password, AppError},
};

pub struct ShareService {
    pool: PgPool,
}

impl ShareService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// 从 AppState 创建 ShareService（工厂方法）
    pub fn from_state(state: &crate::AppState) -> Self {
        Self::new(state.pool.clone())
    }

    /// 生成分享令牌
    ///
    /// 使用 `utils::crypto::generate_random_token` 生成 32 字符的随机令牌。
    pub fn generate_share_token() -> String {
        generate_random_token(32)
    }

    pub async fn create_share(
        &self,
        user_id: Uuid,
        req: CreateShareRequest,
    ) -> Result<ShareResponse, AppError> {
        // Verify file belongs to user
        let file_exists: Option<(Uuid,)> =
            sqlx::query_as("SELECT id FROM files WHERE id = $1 AND user_id = $2")
                .bind(req.file_id)
                .bind(user_id)
                .fetch_optional(&self.pool)
                .await?;

        if file_exists.is_none() {
            return Err(AppError::NotFound);
        }

        // Generate share token
        let share_token = Self::generate_share_token();

        // Hash password if provided
        let password_hash = req
            .password
            .as_ref()
            .map(|p| hash_password(p))
            .transpose()?;

        // Calculate expiration
        let expires_at = calculate_expiration(req.expires_in_days);

        // Create share
        let share = sqlx::query_as::<_, FileShare>(
            "INSERT INTO file_shares (file_id, user_id, share_token, password_hash, expires_at, max_downloads)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *"
        )
        .bind(req.file_id)
        .bind(user_id)
        .bind(&share_token)
        .bind(&password_hash)
        .bind(expires_at)
        .bind(req.max_downloads)
        .fetch_one(&self.pool)
        .await?;

        // Generate share URL (frontend will construct the full URL)
        let share_url = format!("/share/{}", share_token);

        Ok(ShareResponse {
            share_id: share.id,
            share_url,
            share_token,
            expires_at: share.expires_at,
            max_downloads: share.max_downloads,
        })
    }

    pub async fn get_share_by_token(&self, token: &str) -> Result<FileShare, AppError> {
        let share =
            sqlx::query_as::<_, FileShare>("SELECT * FROM file_shares WHERE share_token = $1")
                .bind(token)
                .fetch_optional(&self.pool)
                .await?
                .ok_or(AppError::NotFound)?;

        // Check expiration
        if let Some(expires_at) = share.expires_at {
            if Utc::now() > expires_at {
                return Err(AppError::Validation("分享链接已过期".to_string()));
            }
        }

        // Check download limit
        if let Some(max_downloads) = share.max_downloads {
            if share.download_count >= max_downloads {
                return Err(AppError::Validation(
                    "分享链接已达到下载次数限制".to_string(),
                ));
            }
        }

        Ok(share)
    }

    pub async fn verify_share_password(
        &self,
        share: &FileShare,
        password: &str,
    ) -> Result<bool, AppError> {
        if let Some(ref hash) = share.password_hash {
            verify_password(password, hash)
        } else {
            Ok(true) // No password required
        }
    }

    pub async fn increment_download_count(&self, share_id: Uuid) -> Result<(), AppError> {
        sqlx::query(
            "UPDATE file_shares SET download_count = download_count + 1, updated_at = $1 WHERE id = $2"
        )
        .bind(Utc::now())
        .bind(share_id)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn delete_share(&self, share_id: Uuid, user_id: Uuid) -> Result<(), AppError> {
        let result = sqlx::query("DELETE FROM file_shares WHERE id = $1 AND user_id = $2")
            .bind(share_id)
            .bind(user_id)
            .execute(&self.pool)
            .await?;

        if result.rows_affected() == 0 {
            return Err(AppError::NotFound);
        }

        Ok(())
    }

    pub async fn batch_create_share(
        &self,
        user_id: Uuid,
        req: BatchShareRequest,
    ) -> Result<BatchShareResponse, AppError> {
        let mut shares = Vec::new();
        let mut failed = Vec::new();

        // Hash password if provided (same for all shares)
        let password_hash = req
            .password
            .as_ref()
            .map(|p| hash_password(p))
            .transpose()?;

        // Calculate expiration (same for all shares)
        let expires_at = calculate_expiration(req.expires_in_days);

        // Process each file
        for file_id in req.file_ids {
            // Verify file belongs to user
            let file_exists: Option<(Uuid,)> =
                sqlx::query_as("SELECT id FROM files WHERE id = $1 AND user_id = $2")
                    .bind(file_id)
                    .bind(user_id)
                    .fetch_optional(&self.pool)
                    .await?;

            if file_exists.is_none() {
                failed.push(file_id);
                continue;
            }

            // Check if share already exists for this file
            let existing_share: Option<FileShare> = sqlx::query_as::<_, FileShare>(
                "SELECT * FROM file_shares WHERE file_id = $1 AND user_id = $2 LIMIT 1",
            )
            .bind(file_id)
            .bind(user_id)
            .fetch_optional(&self.pool)
            .await?;

            if let Some(existing) = existing_share {
                // Return existing share
                let share_url = format!("/share/{}", existing.share_token);
                shares.push(ShareResponse {
                    share_id: existing.id,
                    share_url,
                    share_token: existing.share_token,
                    expires_at: existing.expires_at,
                    max_downloads: existing.max_downloads,
                });
                continue;
            }

            // Generate share token
            let share_token = Self::generate_share_token();

            // Create share
            match sqlx::query_as::<_, FileShare>(
                "INSERT INTO file_shares (file_id, user_id, share_token, password_hash, expires_at, max_downloads)
                 VALUES ($1, $2, $3, $4, $5, $6) RETURNING *"
            )
            .bind(file_id)
            .bind(user_id)
            .bind(&share_token)
            .bind(&password_hash)
            .bind(expires_at)
            .bind(req.max_downloads)
            .fetch_one(&self.pool)
            .await {
                Ok(share) => {
                    let share_url = format!("/share/{}", share_token);
                    shares.push(ShareResponse {
                        share_id: share.id,
                        share_url,
                        share_token,
                        expires_at: share.expires_at,
                        max_downloads: share.max_downloads,
                    });
                }
                Err(_) => {
                    failed.push(file_id);
                }
            }
        }

        Ok(BatchShareResponse { shares, failed })
    }
}
