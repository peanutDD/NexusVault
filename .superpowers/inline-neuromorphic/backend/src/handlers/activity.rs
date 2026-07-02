use axum::{
    extract::{Path, Query, State},
    Json,
};
use chrono::{DateTime, Utc};
use serde::Deserialize;
use uuid::Uuid;

use crate::extractors::auth::AuthenticatedUser;
use crate::repositories::audit_events::{AuditEventListFilters, AuditEventsRepo};
use crate::types::activity::{ActivityEventResponse, ActivityListResponse};
use crate::utils::AppError;
use crate::AppState;

#[derive(Debug, Deserialize)]
pub struct ActivityListQuery {
    cursor: Option<String>,
    limit: Option<i64>,
    source: Option<String>,
    event_type: Option<String>,
    target_type: Option<String>,
    file_id: Option<Uuid>,
    folder_id: Option<Uuid>,
    share_id: Option<Uuid>,
    file_request_id: Option<Uuid>,
    api_token_id: Option<Uuid>,
    date_from: Option<DateTime<Utc>>,
    date_to: Option<DateTime<Utc>>,
}

pub async fn list_activity_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
    Query(query): Query<ActivityListQuery>,
) -> Result<Json<ActivityListResponse>, AppError> {
    Ok(Json(list_activity_for_user(&state, user_id, query).await?))
}

pub async fn list_file_activity_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
    Path(file_id): Path<Uuid>,
    Query(mut query): Query<ActivityListQuery>,
) -> Result<Json<ActivityListResponse>, AppError> {
    state.file_service.get_file(file_id, user_id).await?;
    query.file_id = Some(file_id);
    query.target_type = Some("file".to_string());
    Ok(Json(list_activity_for_user(&state, user_id, query).await?))
}

async fn list_activity_for_user(
    state: &AppState,
    user_id: Uuid,
    query: ActivityListQuery,
) -> Result<ActivityListResponse, AppError> {
    let page = AuditEventsRepo::new(&state.pool)
        .list(
            user_id,
            AuditEventListFilters {
                source: query.source,
                event_type: query.event_type,
                target_type: query.target_type,
                file_id: query.file_id,
                folder_id: query.folder_id,
                share_id: query.share_id,
                file_request_id: query.file_request_id,
                api_token_id: query.api_token_id,
                date_from: query.date_from,
                date_to: query.date_to,
            },
            query.cursor,
            query.limit.unwrap_or(50),
        )
        .await?;

    Ok(ActivityListResponse {
        events: page
            .events
            .into_iter()
            .map(ActivityEventResponse::from)
            .collect(),
        next_cursor: page.next_cursor,
    })
}
