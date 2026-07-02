use axum::routing::{get, patch};
use axum::Router;

use crate::handlers::tags::{
    create_tag_handler, delete_tag_handler, list_tags_handler, update_tag_handler,
};
use crate::AppState;

pub fn create_router() -> Router<AppState> {
    Router::new()
        .route("/", get(list_tags_handler).post(create_tag_handler))
        .route(
            "/{id}",
            patch(update_tag_handler).delete(delete_tag_handler),
        )
}
