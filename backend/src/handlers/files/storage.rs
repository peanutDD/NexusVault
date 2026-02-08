//! 存储用量与配额

use axum::extract::State;
use axum::response::Response;
use serde_json::json;

use crate::extractors::AuthenticatedUser;
use crate::utils::{json_response, AppError};
use crate::AppState;

/// 获取存储使用情况
///
/// 返回用户的存储使用量和配额信息。
pub async fn storage_usage_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
) -> Result<Response, AppError> {
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
