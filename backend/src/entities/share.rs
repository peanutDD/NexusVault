//! 分享实体
//!
//! 对应数据库表 `file_shares`。

use chrono::{DateTime, Utc};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, FromRow)]
pub struct FileShare {
    pub id: Uuid,
    pub file_id: Uuid,
    pub user_id: Uuid,
    pub share_token: String,
    pub password_hash: Option<String>,
    pub expires_at: Option<DateTime<Utc>>,
    pub max_downloads: Option<i32>,
    pub download_count: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}