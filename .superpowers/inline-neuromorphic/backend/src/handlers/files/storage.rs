//! 存储用量与配额

use axum::extract::State;
use axum::response::Response;
use serde_json::json;

use deadpool_redis::redis::cmd;

use crate::extractors::AuthenticatedUser;
use crate::utils::{json_response, AppError};
use crate::AppState;

// =============================================================================
// Storage usage
// =============================================================================
//
// Cached briefly because this endpoint is commonly polled by UI (quota bars).
// It is invalidated by bumping the per-user cache version on uploads/deletes.
/// 获取存储使用情况
///
/// 返回用户的存储使用量和配额信息。
pub async fn storage_usage_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
) -> Result<Response, AppError> {
    if let Some(pool) = &state.redis {
        let redis = crate::services::redis::RedisService::new(pool.clone());
        let ver = redis.get_user_cache_version(user_id).await.unwrap_or(1);
        let cache_key = format!("cache:files:storage_usage:{}:{}", user_id, ver);

        if let Ok(mut conn) = pool.get().await {
            let cached: Result<Option<String>, _> =
                cmd("GET").arg(&cache_key).query_async(&mut conn).await;
            if let Ok(Some(s)) = cached {
                if let Ok(v) = serde_json::from_str::<serde_json::Value>(&s) {
                    return Ok(json_response(v));
                }
            }
        }

        let (total_size, file_count) = state.file_service.get_storage_usage(user_id).await?;
        let quota = state.file_service.get_storage_quota(user_id).await?;

        let quota_mb = quota.map(|q| (q as f64 / 1_048_576.0).round() as i64);
        let usage_percent = quota.map(|q| {
            if q > 0 {
                ((total_size as f64 / q as f64) * 100.0).round() as i32
            } else {
                0
            }
        });

        let body = json!({
            "total_size": total_size,
            "file_count": file_count,
            "total_size_mb": (total_size as f64 / 1_048_576.0).round() as i64,
            "quota": quota,
            "quota_mb": quota_mb,
            "usage_percent": usage_percent,
            "is_unlimited": quota.is_none(),
        });

        if let Ok(mut conn) = pool.get().await {
            if let Ok(s) = serde_json::to_string(&body) {
                let _: Result<(), _> = cmd("SETEX")
                    .arg(&cache_key)
                    .arg(20)
                    .arg(s)
                    .query_async(&mut conn)
                    .await;
            }
        }

        return Ok(json_response(body));
    }

    let (total_size, file_count) = state.file_service.get_storage_usage(user_id).await?;
    let quota = state.file_service.get_storage_quota(user_id).await?;

    // 计算配额信息（MB）
    let quota_mb = quota.map(|q| (q as f64 / 1_048_576.0).round() as i64);
    let usage_percent = quota.map(|q| {
        if q > 0 {
            ((total_size as f64 / q as f64) * 100.0).round() as i32
        } else {
            0
        }
    });

    Ok(json_response(json!({
        "total_size": total_size,
        "file_count": file_count,
        "total_size_mb": (total_size as f64 / 1_048_576.0).round() as i64,
        "quota": quota,
        "quota_mb": quota_mb,
        "usage_percent": usage_percent,
        "is_unlimited": quota.is_none(),
    })))
}
