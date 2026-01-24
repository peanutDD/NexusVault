use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct UploadSession {
    pub id: Uuid,
    pub user_id: Uuid,
    pub filename: String,
    pub mime_type: String,
    pub total_size: i64,
    pub chunk_size: i32,
    pub temp_path: String,
    #[serde(skip_serializing)]
    pub uploaded_parts: Vec<i32>,
    pub created_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct InitChunkedUploadRequest {
    pub filename: String,
    pub mime_type: String,
    pub total_size: u64,
}

#[derive(Debug, Serialize)]
#[allow(dead_code)] // constructed via manual json in handler
pub struct InitChunkedUploadResponse {
    pub upload_id: Uuid,
    pub chunk_size: u32,
    pub total_parts: u32,
}

#[derive(Debug, Serialize)]
#[allow(dead_code)] // constructed via manual json in handler
pub struct ChunkedUploadStatusResponse {
    pub upload_id: Uuid,
    pub uploaded_parts: Vec<i32>,
    pub total_parts: u32,
}

#[derive(Debug, Deserialize)]
pub struct CompleteChunkedUploadRequest {
    #[allow(dead_code)] // validated by handler; service uses session data
    pub filename: String,
    #[allow(dead_code)]
    pub mime_type: String,
}
