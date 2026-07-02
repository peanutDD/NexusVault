//! 文件相关 DTO

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::types::tag::FileTagResponse;

pub const RECENT_COLLECTION_DAYS: i64 = 7;
pub const LARGE_COLLECTION_BYTES: i64 = 104_857_600;
pub const SMART_COLLECTION_FILTERS: [&str; 9] = [
    "favorites",
    "pinned",
    "recent",
    "untagged",
    "large",
    "duplicates",
    "images",
    "pdfs",
    "videos",
];

pub fn parse_collection_filters(collection: Option<&str>) -> Vec<&str> {
    let mut filters = Vec::new();
    for item in collection.unwrap_or_default().split(',') {
        let value = item.trim();
        if value.is_empty()
            || !SMART_COLLECTION_FILTERS.contains(&value)
            || filters.contains(&value)
        {
            continue;
        }
        filters.push(value);
    }
    filters
}

#[derive(Clone, Serialize, Deserialize)]
pub struct FileResponse {
    pub id: Uuid,
    pub filename: String,
    pub original_filename: String,
    pub file_size: i64,
    pub mime_type: String,
    pub category: Option<String>,
    pub folder_id: Option<Uuid>,
    pub tags: Vec<FileTagResponse>,
    pub is_favorite: bool,
    pub is_pinned: bool,
    pub last_opened_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Deserialize, Default)]
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
    pub tag_id: Option<Uuid>,
    pub collection: Option<String>,
    pub sort_by: Option<String>,
    pub sort_order: Option<String>,
    pub include_total: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileListResult {
    pub files: Vec<crate::entities::file::File>,
    pub total: Option<i64>,
    pub next_cursor: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct FileCollectionCountsResponse {
    pub collections: std::collections::HashMap<String, i64>,
    pub tags: std::collections::HashMap<String, i64>,
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

#[derive(Debug, Serialize)]
pub struct BatchTrashFailure {
    pub id: Uuid,
    pub message: String,
}

#[derive(Debug, Serialize)]
pub struct BatchTrashResult {
    pub succeeded: u64,
    pub failed: Vec<BatchTrashFailure>,
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

#[derive(Debug, Deserialize)]
pub struct UpdateFileFlagsRequest {
    pub is_favorite: Option<bool>,
    pub is_pinned: Option<bool>,
}
