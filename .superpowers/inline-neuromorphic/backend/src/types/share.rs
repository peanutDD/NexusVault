//! 分享相关 DTO

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Deserialize)]
pub struct CreateShareRequest {
    pub file_id: Uuid,
    pub password: Option<String>,
    pub expires_in_days: Option<u32>,
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
pub struct ShareResponse {
    pub share_id: Uuid,
    pub share_url: String,
    pub share_token: String,
    pub expires_at: Option<DateTime<Utc>>,
    pub max_downloads: Option<i32>,
}

#[derive(Debug, Serialize)]
pub struct BatchShareResponse {
    pub shares: Vec<ShareResponse>,
    pub failed: Vec<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateShareRequest {
    pub password: Option<String>,
    pub clear_password: Option<bool>,
    pub expires_in_days: Option<u32>,
    pub max_downloads: Option<i32>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ManagedShareResponse {
    pub id: Uuid,
    pub file_id: Uuid,
    pub filename: String,
    pub share_token: String,
    pub url: String,
    pub expires_at: Option<DateTime<Utc>>,
    pub max_downloads: Option<i32>,
    pub download_count: i32,
    pub access_count: i64,
    pub has_password: bool,
    pub status: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ShareAccessEventResponse {
    pub id: Uuid,
    pub share_id: Uuid,
    pub event_type: String,
    pub status: i32,
    pub created_at: DateTime<Utc>,
}
