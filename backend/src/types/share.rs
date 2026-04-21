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
