use axum::{
    routing::{get, post},
    Router,
};

use crate::handlers::files::{
    fulltext_rebuild_handler, fulltext_search_handler, ocr_status_handler, semantic_search_handler,
};
use crate::AppState;

pub(super) fn router() -> Router<AppState> {
    Router::new()
        .route("/search/fulltext", get(fulltext_search_handler))
        .route("/search/fulltext/rebuild", post(fulltext_rebuild_handler))
        .route("/search/ocr/status", get(ocr_status_handler))
        .route("/search/semantic", get(semantic_search_handler))
}
