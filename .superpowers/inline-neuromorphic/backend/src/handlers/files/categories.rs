//! 文件分类

use axum::extract::State;
use axum::response::Response;
use serde_json::json;

use deadpool_redis::redis::cmd;

use crate::extractors::AuthenticatedUser;
use crate::utils::{json_response, AppError};
use crate::AppState;

// =============================================================================
// Categories
// =============================================================================
//
// Cached because it is frequently used to build filter dropdowns and nav chips.
// It is invalidated by bumping the per-user cache version on any write path.
/// 获取文件分类列表
///
/// 返回用户所有文件的分类列表（去重）。
pub async fn categories_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
) -> Result<Response, AppError> {
    if let Some(pool) = &state.redis {
        let redis = crate::services::redis::RedisService::new(pool.clone());
        let ver = redis.get_user_cache_version(user_id).await.unwrap_or(1);
        let cache_key = format!("cache:files:categories:{}:{}", user_id, ver);

        if let Ok(mut conn) = pool.get().await {
            let cached: Result<Option<String>, _> =
                cmd("GET").arg(&cache_key).query_async(&mut conn).await;
            if let Ok(Some(s)) = cached {
                if let Ok(v) = serde_json::from_str::<serde_json::Value>(&s) {
                    return Ok(json_response(v));
                }
            }
        }

        let categories = state.file_service.list_categories(user_id).await?;
        let body = json!({ "categories": categories });

        if let Ok(mut conn) = pool.get().await {
            if let Ok(s) = serde_json::to_string(&body) {
                let _: Result<(), _> = cmd("SETEX")
                    .arg(&cache_key)
                    .arg(60)
                    .arg(s)
                    .query_async(&mut conn)
                    .await;
            }
        }

        return Ok(json_response(body));
    }

    let categories = state.file_service.list_categories(user_id).await?;
    Ok(json_response(json!({ "categories": categories })))
}
