//! 分块上传会话实体
//!
//! 对应数据库表 `upload_sessions`。

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
    pub uploaded_parts: Vec<i32>,
    pub created_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
}