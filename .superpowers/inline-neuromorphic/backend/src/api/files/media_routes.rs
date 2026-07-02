use axum::{
    routing::{get, post},
    Router,
};

use crate::handlers::files::{
    download_file_handler, gif_video_preview_handler, hls_asset_handler, hls_playlist_handler,
    hls_prepare_handler, hls_status_handler, preview_file_handler, thumbnail_file_handler,
    video_preview_prepare_handler, video_preview_status_handler,
};
use crate::AppState;

pub(super) fn router() -> Router<AppState> {
    Router::new()
        .route(
            "/{id}/download",
            get(download_file_handler).head(download_file_handler),
        )
        // GIF → 视频预览（按需转码为 mp4，前端用 <video> 播放）
        .route(
            "/{id}/preview/video",
            get(gif_video_preview_handler).head(gif_video_preview_handler),
        )
        .route(
            "/{id}/preview/video/prepare",
            post(video_preview_prepare_handler),
        )
        .route(
            "/{id}/preview/video/status",
            get(video_preview_status_handler),
        )
        .route(
            "/{id}/preview",
            get(preview_file_handler).head(preview_file_handler),
        )
        .route("/{id}/thumbnail", get(thumbnail_file_handler))
        .route("/{id}/hls/prepare", post(hls_prepare_handler))
        .route("/{id}/hls/status", get(hls_status_handler))
        .route("/{id}/hls", get(hls_playlist_handler))
        .route("/{id}/hls/{*path}", get(hls_asset_handler))
}
