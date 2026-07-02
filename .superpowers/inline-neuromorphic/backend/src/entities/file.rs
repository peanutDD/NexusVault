//! 文件实体
//!
//! 对应数据库表 `files` 和 `file_versions`。

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct File {
    pub id: Uuid,
    pub user_id: Uuid,
    pub filename: String,
    pub original_filename: String,
    pub file_path: String,
    pub file_size: i64,
    pub mime_type: String,
    pub storage_backend: String,
    pub category: Option<String>,
    pub folder_id: Option<Uuid>,
    pub content_sha256: Option<String>,
    pub is_favorite: bool,
    pub is_pinned: bool,
    pub last_opened_at: Option<DateTime<Utc>>,
    pub review_status: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, FromRow)]
pub struct FileVersion {
    pub id: Uuid,
    pub file_id: Uuid,
    pub user_id: Uuid,
    pub version_number: i32,
    pub filename: String,
    pub original_filename: String,
    pub file_path: String,
    pub file_size: i64,
    pub mime_type: String,
    pub storage_backend: String,
    pub content_sha256: Option<String>,
    pub label: Option<String>,
    pub created_at: DateTime<Utc>,
}
