//! 健康检查与存活检查端点
//!
//! - `/health`、`/readyz`：完整检查（数据库 + 存储），用于 k8s readiness
//! - `/livez`：轻量级存活检查，用于 k8s liveness probe

use axum::extract::State;
use axum::http::StatusCode;
use axum::Json;
use serde_json::json;

use crate::AppState;

/// 健康检查端点
///
/// 检查数据库连接和存储后端状态，用于监控和负载均衡。
/// 任一检查失败时返回 503，body 含各 checks 详情。
pub async fn health_check(
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let mut status = "healthy";
    let mut checks = serde_json::Map::new();

    let db_ok = match sqlx::query("SELECT 1").execute(&state.pool).await {
        Ok(_) => {
            checks.insert("database".to_string(), json!({ "status": "up" }));
            true
        }
        Err(e) => {
            tracing::error!("Health check: database connection failed: {}", e);
            checks.insert(
                "database".to_string(),
                json!({ "status": "down", "error": "connection failed" }),
            );
            status = "unhealthy";
            false
        }
    };

    let storage_ok = match state.storage.health_check().await {
        Ok(_) => {
            checks.insert("storage".to_string(), json!({ "status": "up" }));
            true
        }
        Err(e) => {
            tracing::error!("Health check: storage backend failed: {}", e);
            checks.insert(
                "storage".to_string(),
                json!({ "status": "down", "error": format!("{}", e) }),
            );
            status = "unhealthy";
            false
        }
    };

    let response = json!({
        "status": status,
        "timestamp": chrono::Utc::now().to_rfc3339(),
        "checks": checks
    });

    if db_ok && storage_ok {
        Ok(Json(response))
    } else {
        Err((StatusCode::SERVICE_UNAVAILABLE, Json(response)))
    }
}

/// 轻量级存活检查（用于 k8s liveness probe）
pub async fn liveness_check() -> &'static str {
    "OK"
}
