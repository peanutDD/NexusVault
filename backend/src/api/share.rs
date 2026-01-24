use axum::routing::{delete, get, post};
use axum::Router;

use crate::handlers::share::{
    access_share_handler, batch_create_share_handler, create_share_handler, delete_share_handler,
    download_shared_file_handler,
};

pub fn create_router() -> Router {
    Router::new()
        .route("/", post(create_share_handler))
        .route("/batch", post(batch_create_share_handler))
        .route("/:token/access", post(access_share_handler))
        .route("/:token/download", get(download_shared_file_handler))
        .route("/:id", delete(delete_share_handler))
}
