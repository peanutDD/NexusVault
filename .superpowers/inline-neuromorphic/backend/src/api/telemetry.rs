//! 前端埋点 / 遥测上报入口
//!
//! 设计目标：
//! - 接收前端关键交互与错误事件
//! - 将事件以结构化日志的方式打到后端日志中，便于后续做告警与统计
//! - 不做复杂存储与查询逻辑，保持轻量

use axum::{extract::State, routing::post, Json, Router};
use serde::Deserialize;

use crate::{extractors::AuthenticatedUser, utils::AppError, AppState};

/// 前端上报的遥测事件模型
#[derive(Debug, Deserialize)]
pub struct TelemetryEvent {
    /// 事件大类：upload / download / preview / error / ui / transcode 等
    pub event_type: String,
    /// 具体动作：如 upload_with_instant、download_file、open_preview 等
    pub action: String,
    /// 状态：start / success / failure
    pub status: Option<String>,
    /// 本次操作耗时（毫秒），可选
    pub duration_ms: Option<u64>,
    /// 错误信息（仅在 failure 时填）
    pub error_message: Option<String>,
    /// 关联的文件 ID（若有）
    pub file_id: Option<String>,
    /// 关联的文件大小（字节，若有）
    pub file_size: Option<u64>,
    /// 额外上下文信息
    pub extra: Option<serde_json::Value>,
}

/// 遥测事件上报入口。
///
/// 安全性：
/// - 仅接受已认证用户（AuthenticatedUser），通过 JWT / API Token 识别 user_id
/// - 只做结构化日志，不回显敏感信息
pub async fn ingest_telemetry_event(
    State(_state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
    Json(event): Json<TelemetryEvent>,
) -> Result<(), AppError> {
    let status = event.status.as_deref().unwrap_or("none");
    let duration_ms = event.duration_ms.unwrap_or(0);

    // 以独立 target 打日志，便于在日志系统中单独索引 / 做告警
    tracing::info!(
        target: "frontend_telemetry",
        user_id = %user_id,
        event_type = %event.event_type,
        action = %event.action,
        status = %status,
        duration_ms = duration_ms,
        error_message = event.error_message.as_deref().unwrap_or(""),
        file_id = event.file_id.as_deref().unwrap_or(""),
        file_size = event.file_size.unwrap_or(0),
        extra = %event
            .extra
            .as_ref()
            .map(|v| v.to_string())
            .unwrap_or_else(String::new),
        "frontend_event"
    );

    Ok(())
}

pub fn create_router() -> Router<AppState> {
    Router::new().route("/events", post(ingest_telemetry_event))
}
