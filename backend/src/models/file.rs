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
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct FileResponse {
    pub id: Uuid,
    pub filename: String,
    pub original_filename: String,
    pub file_size: i64,
    pub mime_type: String,
    pub category: Option<String>,
    pub created_at: DateTime<Utc>,
}

impl From<File> for FileResponse {
    fn from(file: File) -> Self {
        FileResponse {
            id: file.id,
            filename: file.filename,
            original_filename: file.original_filename,
            file_size: file.file_size,
            mime_type: file.mime_type,
            category: file.category,
            created_at: file.created_at,
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct FileListQuery {
    pub page: Option<u32>,
    pub limit: Option<u32>,
    pub search: Option<String>,
    pub mime_type: Option<String>,
    pub category: Option<String>,
    pub date_from: Option<String>,
    pub date_to: Option<String>,
    pub size_min: Option<i64>,
    pub size_max: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct BatchDeleteRequest {
    pub ids: Vec<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct BatchMoveRequest {
    pub ids: Vec<Uuid>,
    /// Target category. Empty string or null = uncategorized.
    pub category: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
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

#[derive(Debug, Deserialize)]
pub struct CreateShareRequest {
    pub file_id: Uuid,
    pub password: Option<String>,
    pub expires_in_days: Option<u32>,
    pub max_downloads: Option<i32>,
}

#[derive(Debug, Serialize)]
pub struct ShareResponse {
    pub share_id: Uuid,
    pub share_url: String,
    pub share_token: String,
    pub expires_at: Option<DateTime<Utc>>,
    pub max_downloads: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct AccessShareRequest {
    pub password: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct BatchShareRequest {
    pub file_ids: Vec<Uuid>,
    pub password: Option<String>,
    pub expires_in_days: Option<u32>,
    pub max_downloads: Option<i32>,
}

#[derive(Debug, Serialize)]
pub struct BatchShareResponse {
    pub shares: Vec<ShareResponse>,
    pub failed: Vec<Uuid>, // File IDs that failed to share
}
