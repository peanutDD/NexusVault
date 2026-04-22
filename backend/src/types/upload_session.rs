//! 分块上传相关 DTO

use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Deserialize)]
pub struct InitChunkedUploadRequest {
    pub filename: String,
    pub mime_type: String,
    pub total_size: u64,
}

#[derive(Debug, Serialize)]
pub struct InitChunkedUploadResponse {
    pub upload_id: Uuid,
    pub chunk_size: u32,
    pub total_parts: u32,
}

#[derive(Debug, Deserialize)]
pub struct CompleteChunkedUploadRequest {
    pub folder_id: Option<Uuid>,
}

#[derive(Debug, Serialize)]
pub struct ChunkedUploadStatusResponse {
    pub upload_id: Uuid,
    pub uploaded_parts: Vec<i32>,
    pub total_parts: u32,
}
