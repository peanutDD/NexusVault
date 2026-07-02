//! API Token 相关 DTO

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use validator::Validate;

#[derive(Debug, Deserialize, Validate)]
pub struct CreateApiTokenRequest {
    #[validate(length(min = 1, max = 255))]
    pub name: String,
    pub expires_in_days: Option<u32>,
    pub webdav_enabled: Option<bool>,
    pub webdav_read_only: Option<bool>,
    pub webdav_root_folder_id: Option<Uuid>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct UpdateApiTokenRequest {
    #[validate(length(min = 1, max = 255))]
    pub name: Option<String>,
    pub webdav_enabled: Option<bool>,
    pub webdav_read_only: Option<bool>,
    pub webdav_root_folder_id: Option<Option<Uuid>>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateWebDavWizardTokenRequest {
    #[validate(length(min = 1, max = 255))]
    pub name: Option<String>,
    pub webdav_read_only: Option<bool>,
    pub webdav_root_folder_id: Option<Uuid>,
}

#[derive(Debug, Serialize)]
pub struct ApiTokenResponse {
    pub id: Uuid,
    pub name: String,
    pub token: String,
    pub expires_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub webdav_enabled: bool,
    pub webdav_read_only: bool,
    pub webdav_root_folder_id: Option<Uuid>,
}

#[derive(Debug, Serialize)]
pub struct ApiTokenListItem {
    pub id: Uuid,
    pub name: String,
    pub last_used_at: Option<DateTime<Utc>>,
    pub expires_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub webdav_enabled: bool,
    pub webdav_read_only: bool,
    pub webdav_root_folder_id: Option<Uuid>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct WebDavAccessEventListItem {
    pub id: Uuid,
    pub api_token_id: Option<Uuid>,
    pub token_name: Option<String>,
    pub method: String,
    pub path: String,
    pub status_code: i32,
    pub read_only: bool,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct WebDavStatusBuckets {
    #[serde(rename = "2xx")]
    pub status_2xx: i64,
    #[serde(rename = "3xx")]
    pub status_3xx: i64,
    #[serde(rename = "401")]
    pub status_401: i64,
    #[serde(rename = "403")]
    pub status_403: i64,
    #[serde(rename = "416")]
    pub status_416: i64,
    #[serde(rename = "423")]
    pub status_423: i64,
    #[serde(rename = "5xx")]
    pub status_5xx: i64,
    pub other: i64,
}

#[derive(Debug, Serialize, FromRow)]
pub struct WebDavDiagnosticListItem {
    pub token_id: Uuid,
    pub token_name: String,
    pub webdav_enabled: bool,
    pub webdav_read_only: bool,
    pub webdav_root_folder_id: Option<Uuid>,
    pub last_used_at: Option<DateTime<Utc>>,
    pub last_webdav_access_at: Option<DateTime<Utc>>,
    pub last_ip: Option<String>,
    pub last_user_agent: Option<String>,
    pub read_count: i64,
    pub write_count: i64,
    #[sqlx(flatten)]
    pub status_buckets: WebDavStatusBuckets,
}
