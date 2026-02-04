//! # 分享服务模块
//!
//! 提供文件分享的核心业务逻辑。

use chrono::Utc;
use sqlx::PgPool;
use uuid::Uuid;

use crate::{
    models::share::{
        BatchShareRequest, BatchShareResponse, CreateShareRequest, FileShare, ShareResponse,
    },
    repositories::{FilesRepo, SharesRepo},
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
    pub fn generate_share_token() -> String {
        generate_random_token(32)
    }

    /// 创建分享
    pub async fn create_share(
        &self,
        user_id: Uuid,
        req: CreateShareRequest,
    ) -> Result<ShareResponse, AppError> {
        let files_repo = FilesRepo::new(&self.pool);
        let shares_repo = SharesRepo::new(&self.pool);

        // 验证文件属于该用户
        if !files_repo.file_belongs_to_user(req.file_id, user_id).await? {
            return Err(AppError::NotFound);
        }

        // 生成分享令牌
        let share_token = Self::generate_share_token();

        // 哈希密码（如果提供）
        let password_hash = req
            .password
            .as_ref()
            .map(|p| hash_password(p))
            .transpose()?;

        // 计算过期时间
        let expires_at = calculate_expiration(req.expires_in_days);

        // 创建分享
        let share = shares_repo
            .create(
                req.file_id,
                user_id,
                &share_token,
                password_hash.as_deref(),
                expires_at,
                req.max_downloads,
            )
            .await?;

        // 生成分享 URL
        let share_url = format!("/share/{}", share_token);

        Ok(ShareResponse {
            share_id: share.id,
            share_url,
            share_token,
            expires_at: share.expires_at,
            max_downloads: share.max_downloads,
        })
    }

    /// 根据 token 获取分享信息
    pub async fn get_share_by_token(&self, token: &str) -> Result<FileShare, AppError> {
        let repo = SharesRepo::new(&self.pool);

        let share = repo.find_by_token(token).await?.ok_or(AppError::NotFound)?;

        // 检查是否过期
        if let Some(expires_at) = share.expires_at {
            if Utc::now() > expires_at {
                return Err(AppError::Validation("分享链接已过期".to_string()));
            }
        }

        // 检查下载次数限制
        if let Some(max_downloads) = share.max_downloads {
            if share.download_count >= max_downloads {
                return Err(AppError::Validation(
                    "分享链接已达到下载次数限制".to_string(),
                ));
            }
        }

        Ok(share)
    }

    /// 验证分享密码
    pub async fn verify_share_password(
        &self,
        share: &FileShare,
        password: &str,
    ) -> Result<bool, AppError> {
        if let Some(ref hash) = share.password_hash {
            verify_password(password, hash)
        } else {
            Ok(true) // 无需密码
        }
    }

    /// 增加下载计数
    pub async fn increment_download_count(&self, share_id: Uuid) -> Result<(), AppError> {
        let repo = SharesRepo::new(&self.pool);
        repo.increment_download_count(share_id).await
    }

    /// 删除分享
    pub async fn delete_share(&self, share_id: Uuid, user_id: Uuid) -> Result<(), AppError> {
        let repo = SharesRepo::new(&self.pool);

        let affected = repo.delete_by_id(share_id).await?;

        if affected == 0 {
            return Err(AppError::NotFound);
        }

        Ok(())
    }

    /// 批量创建分享
    pub async fn batch_create_share(
        &self,
        user_id: Uuid,
        req: BatchShareRequest,
    ) -> Result<BatchShareResponse, AppError> {
        let files_repo = FilesRepo::new(&self.pool);
        let shares_repo = SharesRepo::new(&self.pool);

        let mut shares = Vec::new();
        let mut failed = Vec::new();

        // 哈希密码（如果提供，所有分享使用相同密码）
        let password_hash = req
            .password
            .as_ref()
            .map(|p| hash_password(p))
            .transpose()?;

        // 计算过期时间（所有分享使用相同过期时间）
        let expires_at = calculate_expiration(req.expires_in_days);

        // 处理每个文件
        for file_id in req.file_ids {
            // 验证文件属于该用户
            if !files_repo.file_belongs_to_user(file_id, user_id).await? {
                failed.push(file_id);
                continue;
            }

            // 检查是否已存在分享
            if let Some(existing) = shares_repo.find_by_file_and_user(file_id, user_id).await? {
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

            // 生成分享令牌
            let share_token = Self::generate_share_token();

            // 创建分享
            match shares_repo
                .create(
                    file_id,
                    user_id,
                    &share_token,
                    password_hash.as_deref(),
                    expires_at,
                    req.max_downloads,
                )
                .await
            {
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
