use axum::extract::{Path, Query, State};
use axum::response::Response;
use serde::Deserialize;
use serde_json::json;
use uuid::Uuid;

use crate::extractors::AdminToken;
use crate::utils::{json_response, AppError};
use crate::AppState;

#[derive(Debug, Deserialize)]
pub struct AdminListTasksQuery {
    pub task_type: Option<String>,
    pub status: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

pub async fn admin_list_tasks_handler(
    State(state): State<AppState>,
    AdminToken: AdminToken,
    Query(q): Query<AdminListTasksQuery>,
) -> Result<Response, AppError> {
    let limit = q.limit.unwrap_or(100).clamp(1, 200);
    let offset = q.offset.unwrap_or(0).max(0);

    if let Some(status) = q.status.as_deref() {
        match status {
            "pending" | "running" | "succeeded" | "failed" => {}
            _ => return Err(AppError::Validation("无效的 status".to_string())),
        }
    }

    let tasks = state
        .task_queue
        .list_tasks(q.task_type.as_deref(), q.status.as_deref(), limit, offset)
        .await?;

    Ok(json_response(json!({ "tasks": tasks })))
}

pub async fn admin_retry_task_handler(
    State(state): State<AppState>,
    AdminToken: AdminToken,
    Path(task_id): Path<Uuid>,
) -> Result<Response, AppError> {
    let ok = state.task_queue.retry_task(task_id).await?;
    if !ok {
        return Err(AppError::NotFound);
    }
    Ok(json_response(json!({ "message": "ok" })))
}
