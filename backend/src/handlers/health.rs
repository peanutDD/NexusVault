//! 健康检查与存活检查端点
//!
//! - `/health`、`/readyz`：完整检查（数据库 + 存储），用于 k8s readiness
//! - `/livez`：轻量级存活检查，用于 k8s liveness probe

use axum::extract::State;
use axum::http::StatusCode;
use axum::Json;
use serde_json::json;

use crate::AppState;

/// 就绪检查端点（用于 k8s readiness probe）
///
/// 检查数据库连接、Redis 连接和存储后端状态。
/// 任一检查失败时返回 503，body 含各 checks 详情。
#[utoipa::path(
    get,
    path = "/readyz",
    responses(
        (status = 200, description = "系统就绪"),
        (status = 503, description = "系统未就绪，依赖项故障")
    ),
    tag = "health"
)]
pub async fn readiness_check(
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let mut status = "healthy";
    let mut checks = serde_json::Map::new();

    // 1. 数据库检查
    let db_ok = match sqlx::query("SELECT 1").execute(&state.pool).await {
        Ok(_) => {
            checks.insert("database".to_string(), json!({ "status": "up" }));
            true
        }
        Err(e) => {
            tracing::error!("Readiness check: database connection failed: {}", e);
            checks.insert(
                "database".to_string(),
                json!({ "status": "down", "error": "connection failed" }),
            );
            status = "unhealthy";
            false
        }
    };

    // 2. Redis 检查 (如果配置了)
    let redis_ok = if let Some(pool) = &state.redis {
        match pool.get().await {
            Ok(mut conn) => {
                match deadpool_redis::redis::cmd("PING")
                    .query_async::<_, String>(&mut conn)
                    .await
                {
                    Ok(_) => {
                        checks.insert("redis".to_string(), json!({ "status": "up" }));
                        true
                    }
                    Err(e) => {
                        tracing::error!("Readiness check: redis ping failed: {}", e);
                        checks.insert(
                            "redis".to_string(),
                            json!({ "status": "down", "error": format!("{}", e) }),
                        );
                        status = "unhealthy";
                        false
                    }
                }
            }
            Err(e) => {
                tracing::error!("Readiness check: redis connection pool failed: {}", e);
                checks.insert(
                    "redis".to_string(),
                    json!({ "status": "down", "error": "pool exhaustion" }),
                );
                status = "unhealthy";
                false
            }
        }
    } else {
        checks.insert("redis".to_string(), json!({ "status": "disabled" }));
        true
    };

    // 3. 存储检查
    let storage_ok = match state.storage.health_check().await {
        Ok(_) => {
            checks.insert("storage".to_string(), json!({ "status": "up" }));
            true
        }
        Err(e) => {
            tracing::error!("Readiness check: storage backend failed: {}", e);
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

    if db_ok && redis_ok && storage_ok {
        Ok(Json(response))
    } else {
        Err((StatusCode::SERVICE_UNAVAILABLE, Json(response)))
    }
}

/// 健康检查端点 (兼容旧接口，指向 readiness)
#[utoipa::path(
    get,
    path = "/health",
    responses(
        (status = 200, description = "系统健康"),
        (status = 503, description = "系统不健康")
    ),
    tag = "health"
)]
pub async fn health_check(
    state: State<AppState>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    readiness_check(state).await
}

/// 轻量级存活检查（用于 k8s liveness probe）
#[utoipa::path(
    get,
    path = "/livez",
    responses(
        (status = 200, description = "进程存活")
    ),
    tag = "health"
)]
pub async fn liveness_check() -> &'static str {
    "OK"
}
