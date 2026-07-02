//! GIF 视频预览相关 HTTP 处理器。
//!
//! - `GET  /api/files/:id/preview/video`         ：若派生 mp4 已存在，则直接以流的形式返回，供 `<video>` 播放
//! - `POST /api/files/:id/preview/video/prepare` ：触发或复用后台转码任务，并立即返回当前状态
//! - `GET  /api/files/:id/preview/video/status`  ：轮询后台任务状态，用于前端展示「处理中 / 已就绪」
//!
//! 设计要点：
//! - **懒转码**：仅当前端主动调用 prepare/status 时才排队任务，避免无意义的 CPU 消耗
//! - **异步任务队列**：具体转码逻辑在 `services::task_queue` + `FileService::transcode_gif_to_mp4` 中完成
//! - **统一错误处理**：所有错误统一用 `AppError`，由全局 `IntoResponse` 逻辑转成 JSON 响应

// =============================================================================
// 导入：Axum 基础类型、工具库与应用内部依赖
// =============================================================================

use axum::extract::{Path, State}; // Path 提取 URL 路径中的 :id；State 注入全局 AppState
use axum::http::HeaderMap; // HeaderMap 访问请求头（暂未使用，预留给 Range 等扩展）
use axum::response::{IntoResponse, Response}; // Response 为底层 HTTP 响应；IntoResponse 为可转换 trait
use tokio_util::io::ReaderStream; // ReaderStream 将 AsyncRead 包装为 Stream，用于流式响应
use uuid::Uuid; // Uuid 用于文件 / 用户等资源标识

use axum::body::Body; // Body::from_stream 用于从 Stream 构造响应体
use axum::Json; // Json<T> 将结构体自动序列化为 JSON 响应
use serde_json::json;
use sqlx::query_as; // json! 宏方便构建 JSON 对象

use crate::extractors::AuthenticatedUserQuery; // 自定义认证提取器，从请求中解析出当前用户 ID
use crate::utils::response::stream_file_response; // 统一的文件流响应构造函数，设置 Content-Type / disposition 等
use crate::utils::AppError; // 应用统一错误类型，所有 handler 返回 Result<_, AppError>
use crate::AppState; // 全局应用状态，包含配置、数据库池、存储后端、文件服务、任务队列等

/// GIF 视频预览入口。
///
/// 路由：`GET /api/files/:id/preview/video`
///
/// 行为说明：
/// - 仅当请求的文件是 GIF，且派生 mp4 文件已经存在时，才返回 200 和视频流
/// - 若文件不是 GIF，或派生视频尚未生成，则返回 404，让前端根据 prepare/status 的结果决定 UI
pub async fn gif_video_preview_handler(
    State(state): State<AppState>, // 注入全局应用状态（包含文件服务等）
    AuthenticatedUserQuery(user_id): AuthenticatedUserQuery, // 从认证信息中提取当前用户 ID
    Path(file_id): Path<Uuid>,     // 从 URL 路径中解析文件 ID
    _headers: HeaderMap,           // 请求头（目前未使用，预留给 Range 等扩展）
) -> Result<Response, AppError> {
    // 根据 file_id + user_id 查询文件记录，确保用户只能访问自己的文件
    let file = state.file_service.get_file(file_id, user_id).await?; // 若不存在或无权限将返回 AppError::NotFound / Forbidden

    // 将 MIME 类型统一转成小写，避免大小写差异导致判断失败
    let is_gif = state.file_service.is_gif_file(&file).await;

    // 非 GIF 文件直接返回 404，由前端降级为普通预览
    if !is_gif {
        return Err(AppError::NotFound); // 统一使用 NotFound，避免泄露太多内部信息
    }

    // 仅当派生视频已存在时才提供预览；
    // 若仍在转码或未排队，则返回 404，由前端根据 status/prepare 接口展示状态。
    let out_path = state.file_service.derived_video_output_path(file.id); // 根据 file_id 计算 .derived_videos/{file_id}.mp4 路径
                                                                          // 异步检查目标文件是否存在，避免后续打开文件失败
    let exists = tokio::fs::try_exists(&out_path)
        .await
        .map_err(|e| AppError::File(e.to_string()))?; // IO 错误统一包装为 File 错误
    if !exists {
        // 派生 mp4 尚未生成：由前端决定是继续轮询还是展示「处理中」提示
        return Err(AppError::NotFound);
    }

    // 派生 mp4 已存在，打开文件准备以流的形式返回
    let f = tokio::fs::File::open(&out_path)
        .await
        .map_err(|e| AppError::File(format!("打开派生视频失败: {}", e)))?; // 打开失败仍视为文件错误

    // 将文件句柄包装为异步字节流，方便边读边发
    let body = Body::from_stream(ReaderStream::new(f)); // Body::from_stream 接受实现 Stream 的数据源

    // 使用统一的文件流响应构造函数，设置合适的 Content-Type / 文件名 / inline 展示等
    stream_file_response(body, "preview.mp4", "video/mp4", true, None)
        .map_err(|_| AppError::Internal) // 理论上很少失败，失败时统一映射为内部错误
}

/// 启动 GIF 视频预览转码（目前仅用于 GIF）。
///
/// 路由：`POST /api/files/:id/preview/video/prepare`
///
/// 行为说明：
/// - 若派生 mp4 已存在：立即返回 `{ "status": "ready" }`
/// - 若不存在：将任务写入后台队列，返回 `{ "status": "processing" }`
/// - 非 GIF 文件：返回 `AppError::Validation("仅 GIF 支持视频预览")`
pub async fn video_preview_prepare_handler(
    State(state): State<AppState>,                           // 全局应用状态
    AuthenticatedUserQuery(user_id): AuthenticatedUserQuery, // 当前用户 ID（已认证）
    Path(file_id): Path<Uuid>,                               // 请求中携带的文件 ID
) -> Result<impl IntoResponse, AppError> {
    // 根据 file_id + user_id 查询文件记录，校验所有权与存在性
    let file = state.file_service.get_file(file_id, user_id).await?; // 不存在或无权限时返回相应 AppError

    // 将 MIME 统一转为小写，便于匹配
    let is_gif = state.file_service.is_gif_file(&file).await;
    if !is_gif {
        // 对非 GIF 文件返回验证错误，让前端降级为普通预览
        return Err(AppError::Validation("仅 GIF 支持视频预览".to_string()));
    }
    if file.storage_backend != "local" {
        return Err(AppError::Validation(
            "GIF 视频预览当前仅支持本地存储".to_string(),
        ));
    }

    // 计算派生视频的目标路径
    let out_path = state.file_service.derived_video_output_path(file.id); // storage_path/.derived_videos/{file_id}.mp4
                                                                          // 若目标已存在，说明之前已经转码完成，直接认为 ready
    if tokio::fs::try_exists(&out_path)
        .await
        .map_err(|e| AppError::File(e.to_string()))?
    {
        // 前端拿到 "ready" 即可直接请求 /preview/video
        return Ok(Json(json!({ "status": "ready" })));
    }

    // 若派生视频不存在，则排队后台任务，由 Worker 异步转码。
    // payload 中携带 file_id / user_id / storage_backend / source_path，Worker 会据此查询最新文件记录并执行转码。
    let payload = json!({
        "file_id": file.id,                    // 需要转码的视频对应的文件 ID
        "user_id": user_id,                    // 发起请求的用户 ID，用于权限校验
        "storage_backend": file.storage_backend, // 当前文件所在的存储后端（local / s3 等）
        "source_path": file.file_path,         // 源 GIF 的物理路径或对象 key
    });

    // 用 file_id 作为幂等 key，避免同一个 GIF 被重复排队多次
    let _task = state
        .task_queue
        .enqueue_task("gif_preview", payload, Some(&file.id.to_string()))
        .await?; // 若插入队列失败，将映射为 AppError::Database / AppError::Internal 等

    // 为保持与前端约定一致，非 ready 状态统一视为 processing（前端据此显示「处理中」并轮询 status）
    Ok(Json(json!({ "status": "processing" })))
}

/// 查询 GIF 视频预览转码状态（前端轮询使用）。
pub async fn video_preview_status_handler(
    State(state): State<AppState>,
    AuthenticatedUserQuery(user_id): AuthenticatedUserQuery,
    Path(file_id): Path<Uuid>,
) -> Result<impl IntoResponse, AppError> {
    let file = state.file_service.get_file(file_id, user_id).await?;
    let out_path = state.file_service.derived_video_output_path(file.id);
    let has_video = tokio::fs::try_exists(&out_path)
        .await
        .map_err(|e| AppError::File(e.to_string()))?;
    if has_video {
        return Ok(Json(json!({ "status": "ready", "error": null })));
    }

    let latest: Option<(String, Option<String>)> = query_as(
        "SELECT status, last_error
         FROM background_tasks
         WHERE task_type = $1
           AND dedupe_key = $2
         ORDER BY created_at DESC
         LIMIT 1",
    )
    .bind("gif_preview")
    .bind(file.id.to_string())
    .fetch_optional(&state.pool)
    .await
    .map_err(AppError::from)?;

    if let Some((status, last_error)) = latest {
        if status == "failed" {
            return Ok(Json(json!({ "status": "failed", "error": last_error })));
        }
    }

    Ok(Json(json!({ "status": "processing", "error": null })))
}
