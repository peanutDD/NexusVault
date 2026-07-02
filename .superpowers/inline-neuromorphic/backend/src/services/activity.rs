use serde_json::Value;
use sqlx::PgPool;
use uuid::Uuid;

use crate::repositories::audit_events::{AuditEventsRepo, CreateAuditEvent};
use crate::utils::AppError;

pub struct AuditEventInput<'a> {
    pub user_id: Uuid,
    pub actor_type: &'a str,
    pub actor_user_id: Option<Uuid>,
    pub source: &'a str,
    pub event_type: &'a str,
    pub target_type: &'a str,
    pub file_id: Option<Uuid>,
    pub folder_id: Option<Uuid>,
    pub share_id: Option<Uuid>,
    pub file_request_id: Option<Uuid>,
    pub api_token_id: Option<Uuid>,
    pub status: Option<i32>,
    pub ip_address: Option<&'a str>,
    pub user_agent: Option<&'a str>,
    pub metadata: Value,
}

#[derive(Clone)]
pub struct AuditService {
    pool: PgPool,
}

impl AuditService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub fn from_state(state: &crate::AppState) -> Self {
        Self::new(state.pool.clone())
    }

    pub async fn record(&self, input: AuditEventInput<'_>) -> Result<(), AppError> {
        AuditEventsRepo::new(&self.pool)
            .create(CreateAuditEvent {
                user_id: input.user_id,
                actor_type: input.actor_type,
                actor_user_id: input.actor_user_id,
                source: input.source,
                event_type: input.event_type,
                target_type: input.target_type,
                file_id: input.file_id,
                folder_id: input.folder_id,
                share_id: input.share_id,
                file_request_id: input.file_request_id,
                api_token_id: input.api_token_id,
                status: input.status,
                ip_address: input.ip_address,
                user_agent: input.user_agent,
                metadata: input.metadata,
            })
            .await?;
        Ok(())
    }

    pub async fn record_lenient(&self, input: AuditEventInput<'_>) {
        let event_type = input.event_type.to_string();
        let user_id = input.user_id;
        if let Err(error) = self.record(input).await {
            tracing::warn!(%user_id, %event_type, %error, "failed to record audit event");
        }
    }
}
