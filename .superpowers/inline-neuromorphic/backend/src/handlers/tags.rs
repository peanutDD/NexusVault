use axum::extract::{Path, State};
use axum::response::Response;
use serde_json::json;
use uuid::Uuid;

use crate::extractors::AuthenticatedUser;
use crate::types::tag::{CreateTagRequest, FileTagResponse, UpdateTagRequest};
use crate::utils::{json_response, success_response, AppError};
use crate::AppState;

pub async fn list_tags_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
) -> Result<Response, AppError> {
    let tags = sqlx::query_as::<_, FileTagResponse>(
        "SELECT id, name, color, created_at FROM file_tags WHERE user_id = $1 ORDER BY lower(name)",
    )
    .bind(user_id)
    .fetch_all(&state.pool)
    .await
    .map_err(AppError::from)?;
    Ok(json_response(json!({ "tags": tags })))
}

pub async fn create_tag_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
    axum::Json(req): axum::Json<CreateTagRequest>,
) -> Result<Response, AppError> {
    let name = req.name.trim();
    if name.is_empty() {
        return Err(AppError::Validation("标签名不能为空".to_string()));
    }
    if name.chars().count() > 80 {
        return Err(AppError::Validation("标签名过长".to_string()));
    }
    let color = req
        .color
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty());
    let tag = sqlx::query_as::<_, FileTagResponse>(
        "INSERT INTO file_tags (user_id, name, color)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, lower(name))
         DO UPDATE SET color = EXCLUDED.color, updated_at = CURRENT_TIMESTAMP
         RETURNING id, name, color, created_at",
    )
    .bind(user_id)
    .bind(name)
    .bind(color)
    .fetch_one(&state.pool)
    .await
    .map_err(AppError::from)?;
    Ok(json_response(json!({ "tag": tag })))
}

pub async fn update_tag_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
    Path(tag_id): Path<Uuid>,
    axum::Json(req): axum::Json<UpdateTagRequest>,
) -> Result<Response, AppError> {
    let tag = sqlx::query_as::<_, FileTagResponse>(
        "UPDATE file_tags
         SET name = COALESCE(NULLIF(TRIM($1), ''), name),
             color = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3 AND user_id = $4
         RETURNING id, name, color, created_at",
    )
    .bind(req.name.as_deref())
    .bind(req.color.as_deref())
    .bind(tag_id)
    .bind(user_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(AppError::from)?
    .ok_or(AppError::NotFound)?;
    Ok(json_response(json!({ "tag": tag })))
}

pub async fn delete_tag_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
    Path(tag_id): Path<Uuid>,
) -> Result<Response, AppError> {
    let result = sqlx::query("DELETE FROM file_tags WHERE id = $1 AND user_id = $2")
        .bind(tag_id)
        .bind(user_id)
        .execute(&state.pool)
        .await
        .map_err(AppError::from)?;
    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    Ok(success_response("标签已删除"))
}
