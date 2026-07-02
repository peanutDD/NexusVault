//! WebDAV access event entity.
//!
//! Stores metadata only. Token values, passwords, and Authorization headers are
//! intentionally excluded from this table.

use chrono::{DateTime, Utc};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, FromRow)]
pub struct WebDavAccessEvent {
    pub id: Uuid,
    pub user_id: Uuid,
    pub api_token_id: Option<Uuid>,
    pub method: String,
    pub path: String,
    pub status_code: i32,
    pub read_only: bool,
    pub created_at: DateTime<Utc>,
}
