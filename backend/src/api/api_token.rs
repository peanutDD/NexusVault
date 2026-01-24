use axum::{
    routing::{delete, get},
    Router,
};

use crate::handlers::api_token::{create_token_handler, delete_token_handler, list_tokens_handler};

pub fn create_router() -> Router {
    Router::new()
        .route("/", get(list_tokens_handler).post(create_token_handler))
        .route("/:id", delete(delete_token_handler))
}
