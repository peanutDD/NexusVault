//! 文件相关 DTO

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Clone, Serialize, Deserialize)]
pub struct FileResponse {
    pub id: Uuid,
    pub filename: String,
    pub original_filename: String,
    pub file_size: i64,
    pub mime_type: String,
    pub category: Option<String>,
    pub folder_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct FileListQuery {
    pub page: Option<u32>,
    pub limit: Option<u32>,
    pub pagination: Option<String>,
    pub cursor: Option<String>,
    pub search: Option<String>,
    pub mime_type: Option<String>,
    pub category: Option<String>,
    pub folder_id: Option<String>,
    pub date_from: Option<String>,
    pub date_to: Option<String>,
    pub size_min: Option<i64>,
    pub size_max: Option<i64>,
    pub sort_by: Option<String>,
    pub sort_order: Option<String>,
    pub include_total: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FileListResult {
    pub files: Vec<crate::entities::file::File>,
    pub total: Option<i64>,
    pub next_cursor: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct InstantUploadRequest {
    pub content_sha256: String,
    pub filename: String,
    pub file_size: u64,
    pub mime_type: String,
    pub folder_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct BatchDeleteRequest {
    pub ids: Vec<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct BatchMoveRequest {
    pub ids: Vec<Uuid>,
    pub category: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct BatchGetRequest {
    pub ids: Vec<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct RenameFileRequest {
    pub name: String,
}

#[derive(Debug, Serialize)]
pub struct FileVersionResponse {
    pub id: Uuid,
    pub file_id: Uuid,
    pub version_number: i32,
    pub filename: String,
    pub original_filename: String,
    pub file_size: i64,
    pub mime_type: String,
    pub label: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateVersionLabelRequest {
    pub label: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct RestoreVersionRequest {
    pub keep_current: bool,
}
