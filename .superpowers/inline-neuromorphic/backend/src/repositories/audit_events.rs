use chrono::{DateTime, Utc};
use serde_json::{Map, Value};
use sqlx::{PgPool, Postgres, QueryBuilder};
use uuid::Uuid;

use crate::entities::audit_event::AuditEvent;
use crate::utils::AppError;

pub struct CreateAuditEvent<'a> {
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

#[derive(Debug, Clone, Default)]
pub struct AuditEventListFilters {
    pub source: Option<String>,
    pub event_type: Option<String>,
    pub target_type: Option<String>,
    pub file_id: Option<Uuid>,
    pub folder_id: Option<Uuid>,
    pub share_id: Option<Uuid>,
    pub file_request_id: Option<Uuid>,
    pub api_token_id: Option<Uuid>,
    pub date_from: Option<DateTime<Utc>>,
    pub date_to: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone)]
pub struct AuditEventListPage {
    pub events: Vec<AuditEvent>,
    pub next_cursor: Option<String>,
}

pub struct AuditEventsRepo<'a> {
    pool: &'a PgPool,
}

impl<'a> AuditEventsRepo<'a> {
    pub fn new(pool: &'a PgPool) -> Self {
        Self { pool }
    }

    pub async fn create(&self, event: CreateAuditEvent<'_>) -> Result<AuditEvent, AppError> {
        let sanitized_metadata = sanitize_metadata(event.metadata);
        sqlx::query_as::<_, AuditEvent>(
            r#"
            INSERT INTO audit_events (
                user_id, actor_type, actor_user_id, source, event_type, target_type,
                file_id, folder_id, share_id, file_request_id, api_token_id, status, ip_address,
                user_agent, metadata
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            RETURNING *
            "#,
        )
        .bind(event.user_id)
        .bind(event.actor_type)
        .bind(event.actor_user_id)
        .bind(event.source)
        .bind(event.event_type)
        .bind(event.target_type)
        .bind(event.file_id)
        .bind(event.folder_id)
        .bind(event.share_id)
        .bind(event.file_request_id)
        .bind(event.api_token_id)
        .bind(event.status)
        .bind(event.ip_address)
        .bind(event.user_agent)
        .bind(sanitized_metadata)
        .fetch_one(self.pool)
        .await
        .map_err(AppError::from)
    }

    pub async fn list(
        &self,
        user_id: Uuid,
        filters: AuditEventListFilters,
        cursor: Option<String>,
        limit: i64,
    ) -> Result<AuditEventListPage, AppError> {
        let limit = limit.clamp(1, 100);
        let cursor = cursor.as_deref().map(parse_cursor).transpose()?;

        let mut qb: QueryBuilder<'_, Postgres> =
            QueryBuilder::new("SELECT * FROM audit_events WHERE user_id = ");
        qb.push_bind(user_id);

        if let Some(source) = filters.source.as_deref() {
            qb.push(" AND source = ");
            qb.push_bind(source);
        }
        if let Some(event_type) = filters.event_type.as_deref() {
            qb.push(" AND event_type = ");
            qb.push_bind(event_type);
        }
        if let Some(target_type) = filters.target_type.as_deref() {
            qb.push(" AND target_type = ");
            qb.push_bind(target_type);
        }
        if let Some(file_id) = filters.file_id {
            qb.push(" AND file_id = ");
            qb.push_bind(file_id);
        }
        if let Some(folder_id) = filters.folder_id {
            qb.push(" AND folder_id = ");
            qb.push_bind(folder_id);
        }
        if let Some(share_id) = filters.share_id {
            qb.push(" AND share_id = ");
            qb.push_bind(share_id);
        }
        if let Some(file_request_id) = filters.file_request_id {
            qb.push(" AND file_request_id = ");
            qb.push_bind(file_request_id);
        }
        if let Some(api_token_id) = filters.api_token_id {
            qb.push(" AND api_token_id = ");
            qb.push_bind(api_token_id);
        }
        if let Some(date_from) = filters.date_from {
            qb.push(" AND created_at >= ");
            qb.push_bind(date_from);
        }
        if let Some(date_to) = filters.date_to {
            qb.push(" AND created_at <= ");
            qb.push_bind(date_to);
        }
        if let Some((created_at, id)) = cursor {
            qb.push(" AND (created_at, id) < (");
            qb.push_bind(created_at);
            qb.push(", ");
            qb.push_bind(id);
            qb.push(")");
        }

        qb.push(" ORDER BY created_at DESC, id DESC LIMIT ");
        qb.push_bind(limit + 1);

        let mut events = qb
            .build_query_as::<AuditEvent>()
            .fetch_all(self.pool)
            .await
            .map_err(AppError::from)?;

        let next_cursor = if events.len() > limit as usize {
            events.pop();
            events
                .last()
                .map(|event| format_cursor(event.created_at, event.id))
        } else {
            None
        };

        Ok(AuditEventListPage {
            events,
            next_cursor,
        })
    }
}

fn parse_cursor(cursor: &str) -> Result<(DateTime<Utc>, Uuid), AppError> {
    let (created_at, id) = cursor
        .split_once('|')
        .ok_or_else(|| AppError::Validation("无效的 activity cursor".to_string()))?;
    let created_at = DateTime::parse_from_rfc3339(created_at)
        .map_err(|_| AppError::Validation("无效的 activity cursor".to_string()))?
        .with_timezone(&Utc);
    let id = Uuid::parse_str(id)
        .map_err(|_| AppError::Validation("无效的 activity cursor".to_string()))?;
    Ok((created_at, id))
}

fn format_cursor(created_at: DateTime<Utc>, id: Uuid) -> String {
    format!("{}|{}", created_at.to_rfc3339(), id)
}

fn sanitize_metadata(value: Value) -> Value {
    match value {
        Value::Object(map) => Value::Object(sanitize_object(map)),
        Value::Array(items) => Value::Array(items.into_iter().map(sanitize_metadata).collect()),
        other => other,
    }
}

fn sanitize_object(map: Map<String, Value>) -> Map<String, Value> {
    map.into_iter()
        .filter_map(|(key, value)| {
            if is_sensitive_key(&key) {
                None
            } else {
                Some((key, sanitize_metadata(value)))
            }
        })
        .collect()
}

fn is_sensitive_key(key: &str) -> bool {
    let key = key.to_ascii_lowercase();
    key.contains("token")
        || key.contains("password")
        || key.contains("authorization")
        || key.contains("secret")
}
