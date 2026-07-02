use chrono::{DateTime, Utc};
use serde_json::Value;
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, FromRow)]
pub struct AuditEvent {
    pub id: Uuid,
    pub user_id: Uuid,
    pub actor_type: String,
    pub actor_user_id: Option<Uuid>,
    pub source: String,
    pub event_type: String,
    pub target_type: String,
    pub file_id: Option<Uuid>,
    pub folder_id: Option<Uuid>,
    pub share_id: Option<Uuid>,
    pub file_request_id: Option<Uuid>,
    pub api_token_id: Option<Uuid>,
    pub status: Option<i32>,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
    pub metadata: Value,
    pub created_at: DateTime<Utc>,
}
