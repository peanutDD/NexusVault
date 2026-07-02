use axum::{
    routing::{delete, get, post},
    Router,
};

use crate::handlers::files::{
    batch_permanently_delete_files_handler, batch_restore_files_handler, empty_trash_handler,
    list_trash_handler, permanently_delete_file_handler, restore_file_handler,
};
use crate::AppState;

pub(super) fn router() -> Router<AppState> {
    Router::new()
        .route(
            "/trash",
            get(list_trash_handler).delete(empty_trash_handler),
        )
        .route("/trash/batch-restore", post(batch_restore_files_handler))
        .route(
            "/trash/batch-permanent",
            post(batch_permanently_delete_files_handler),
        )
        .route("/{id}/restore", post(restore_file_handler))
        .route("/{id}/permanent", delete(permanently_delete_file_handler))
}
