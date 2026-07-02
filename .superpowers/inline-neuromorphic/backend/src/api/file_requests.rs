use axum::{
    error_handling::HandleErrorLayer,
    extract::DefaultBodyLimit,
    http::StatusCode,
    routing::{get, patch, post},
    Json, Router,
};
use serde_json::json;
use tower::BoxError;
use tower::{limit::ConcurrencyLimitLayer, load_shed::LoadShedLayer, ServiceBuilder};
use tower_http::limit::RequestBodyLimitLayer;

use crate::constants::{MAX_UPLOAD_BODY, UPLOAD_CONCURRENCY};
use crate::handlers::file_requests::{
    create_file_request_handler, file_request_upload_download_handler,
    file_request_upload_preview_handler, list_file_request_inbox_handler,
    list_file_request_uploads_handler, list_file_requests_handler, public_file_request_handler,
    public_file_request_upload_handler, review_file_request_upload_handler,
    update_file_request_handler,
};
use crate::AppState;

async fn overload_response(err: BoxError) -> (StatusCode, Json<serde_json::Value>) {
    tracing::warn!("file request upload concurrency limit triggered: {}", err);
    (
        StatusCode::SERVICE_UNAVAILABLE,
        Json(json!({
            "error": "service overloaded",
            "message": "服务器繁忙，请稍后重试",
            "code": "SERVICE_OVERLOADED"
        })),
    )
}

pub fn create_router() -> Router<AppState> {
    Router::new()
        .route(
            "/",
            get(list_file_requests_handler).post(create_file_request_handler),
        )
        .route("/inbox", get(list_file_request_inbox_handler))
        .route(
            "/uploads/{upload_id}/preview",
            get(file_request_upload_preview_handler).head(file_request_upload_preview_handler),
        )
        .route(
            "/uploads/{upload_id}/download",
            get(file_request_upload_download_handler).head(file_request_upload_download_handler),
        )
        .route(
            "/uploads/{upload_id}/review",
            patch(review_file_request_upload_handler),
        )
        .route("/{id}", patch(update_file_request_handler))
        .route("/{id}/uploads", get(list_file_request_uploads_handler))
        .route("/public/{token}", get(public_file_request_handler))
        .route(
            "/public/{token}/upload",
            post(public_file_request_upload_handler).layer(
                ServiceBuilder::new()
                    .layer(DefaultBodyLimit::max(MAX_UPLOAD_BODY))
                    .layer(RequestBodyLimitLayer::new(MAX_UPLOAD_BODY))
                    .layer(HandleErrorLayer::new(overload_response))
                    .layer(LoadShedLayer::new())
                    .layer(ConcurrencyLimitLayer::new(UPLOAD_CONCURRENCY)),
            ),
        )
}
