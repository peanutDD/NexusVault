use axum::{
    error_handling::HandleErrorLayer,
    extract::DefaultBodyLimit,
    routing::{delete, get, post, put},
    Router,
};
use tower::{limit::ConcurrencyLimitLayer, load_shed::LoadShedLayer, ServiceBuilder};
use tower_http::limit::RequestBodyLimitLayer;

use crate::api::files::overload_response;
use crate::constants::{
    CHUNK_CONCURRENCY, COMPLETE_CONCURRENCY, MAX_CHUNK_BODY, MAX_UPLOAD_BODY, UPLOAD_CONCURRENCY,
};
use crate::handlers::files::{
    chunked_upload_abort_handler, chunked_upload_chunk_handler, chunked_upload_complete_handler,
    chunked_upload_init_handler, chunked_upload_status_handler, instant_upload_handler,
    upload_file_handler,
};
use crate::AppState;

pub(super) fn router() -> Router<AppState> {
    Router::new()
        .route(
            "/upload",
            post(upload_file_handler).layer(
                ServiceBuilder::new()
                    .layer(DefaultBodyLimit::max(MAX_UPLOAD_BODY))
                    .layer(RequestBodyLimitLayer::new(MAX_UPLOAD_BODY))
                    .layer(HandleErrorLayer::new(overload_response))
                    .layer(LoadShedLayer::new())
                    .layer(ConcurrencyLimitLayer::new(UPLOAD_CONCURRENCY)),
            ),
        )
        .route("/upload/instant", post(instant_upload_handler))
        .route(
            "/upload/chunked/init",
            post(chunked_upload_init_handler).layer(
                ServiceBuilder::new()
                    .layer(HandleErrorLayer::new(overload_response))
                    .layer(LoadShedLayer::new())
                    .layer(ConcurrencyLimitLayer::new(UPLOAD_CONCURRENCY)),
            ),
        )
        // Chunk 用 Bytes extractor，须 DefaultBodyLimit 否则默认 2MB 拒收 5MB 块
        .route(
            "/upload/chunked/{id}/chunk",
            put(chunked_upload_chunk_handler).layer(
                ServiceBuilder::new()
                    .layer(DefaultBodyLimit::max(MAX_CHUNK_BODY))
                    .layer(HandleErrorLayer::new(overload_response))
                    .layer(LoadShedLayer::new())
                    .layer(ConcurrencyLimitLayer::new(CHUNK_CONCURRENCY)),
            ),
        )
        .route(
            "/upload/chunked/{id}/status",
            get(chunked_upload_status_handler),
        )
        .route(
            "/upload/chunked/{id}/complete",
            post(chunked_upload_complete_handler).layer(
                ServiceBuilder::new()
                    .layer(HandleErrorLayer::new(overload_response))
                    .layer(LoadShedLayer::new())
                    .layer(ConcurrencyLimitLayer::new(COMPLETE_CONCURRENCY)),
            ),
        )
        .route(
            "/upload/chunked/{id}/abort",
            delete(chunked_upload_abort_handler),
        )
}
