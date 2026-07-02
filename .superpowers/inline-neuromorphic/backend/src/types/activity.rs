use chrono::{DateTime, Utc};
use serde::Serialize;
use serde_json::Value;
use uuid::Uuid;

use crate::entities::audit_event::AuditEvent;

#[derive(Debug, Serialize)]
pub struct ActivityEventResponse {
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

#[derive(Debug, Serialize)]
pub struct ActivityListResponse {
    pub events: Vec<ActivityEventResponse>,
    pub next_cursor: Option<String>,
}

impl From<AuditEvent> for ActivityEventResponse {
    fn from(event: AuditEvent) -> Self {
        Self {
            id: event.id,
            user_id: event.user_id,
            actor_type: event.actor_type,
            actor_user_id: event.actor_user_id,
            source: event.source,
            event_type: event.event_type,
            target_type: event.target_type,
            file_id: event.file_id,
            folder_id: event.folder_id,
            share_id: event.share_id,
            file_request_id: event.file_request_id,
            api_token_id: event.api_token_id,
            status: event.status,
            ip_address: event.ip_address,
            user_agent: event.user_agent,
            metadata: event.metadata,
            created_at: event.created_at,
        }
    }
}
