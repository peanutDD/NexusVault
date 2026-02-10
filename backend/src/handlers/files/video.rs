//! GIF 视频预览：将 GIF 源文件按需转码为 mp4，并以 inline 方式返回，供 `<video>` 播放。

use axum::extract::{Path, State};
use axum::http::HeaderMap;
use axum::response::{IntoResponse, Response};
use tokio_util::io::ReaderStream;
use uuid::Uuid;

use axum::body::Body;
use axum::Json;
use serde_json::json;

use crate::extractors::AuthenticatedUserQuery;
use crate::utils::response::stream_file_response;
use crate::utils::AppError;
use crate::AppState;

/// GIF 视频预览入口。
///
/// - GIF：若无 mp4 派生则同步转码后返回
/// - 其他类型：返回 404
pub async fn gif_video_preview_handler(
    State(state): State<AppState>,
    AuthenticatedUserQuery(user_id): AuthenticatedUserQuery,
    Path(file_id): Path<Uuid>,
    _headers: HeaderMap,
) -> Result<Response, AppError> {
    let file = state.file_service.get_file(file_id, user_id).await?;

    let mime = file.mime_type.to_lowercase();
    let fname = file.original_filename.to_lowercase();

    let is_gif = mime == "image/gif";

    let video_path = if is_gif {
        // GIF 体积相对可控，按懒转码逻辑同步转码
        state.file_service.ensure_gif_video_ready(&file).await?
    } else {
        return Err(AppError::NotFound);
    };

    let f = tokio::fs::File::open(&video_path)
        .await
        .map_err(|e| AppError::File(format!("打开派生视频失败: {}", e)))?;

    let body = Body::from_stream(ReaderStream::new(f));

    stream_file_response(body, "preview.mp4", "video/mp4", true, None)
        .map_err(|_| AppError::Internal)
}

/// 启动 GIF 视频预览转码（目前仅用于 GIF）。
pub async fn video_preview_prepare_handler(
    State(state): State<AppState>,
    AuthenticatedUserQuery(user_id): AuthenticatedUserQuery,
    Path(file_id): Path<Uuid>,
) -> Result<impl IntoResponse, AppError> {
    let file = state.file_service.get_file(file_id, user_id).await?;

    let mime = file.mime_type.to_lowercase();
    let fname = file.original_filename.to_lowercase();
    let is_gif = mime == "image/gif";
    if !is_gif {
        return Err(AppError::Validation(
            "仅 GIF 支持视频预览".to_string(),
        ));
    }

    let out_path = state.file_service.derived_video_output_path(file.id);
    if tokio::fs::try_exists(&out_path)
        .await
        .map_err(|e| AppError::File(e.to_string()))?
    {
        return Ok(Json(json!({ "status": "ready" })));
    }

    // GIF 同步转码，一般很快
    state.file_service.ensure_gif_video_ready(&file).await?;
    Ok(Json(json!({ "status": "ready" })))
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

    let status = if has_video { "ready" } else { "processing" };
    Ok(Json(json!({ "status": status })))
}

