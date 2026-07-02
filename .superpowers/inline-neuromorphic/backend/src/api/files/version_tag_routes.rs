use axum::{
    routing::{delete, get, patch, post, put},
    Router,
};

use crate::handlers::files::{
    delete_version_handler, diff_file_version_handler, download_file_version_handler,
    get_file_version_handler, list_file_versions_handler, preview_file_version_handler,
    restore_version_handler, set_file_tags_handler, update_file_flags_handler,
    update_version_label_handler,
};
use crate::AppState;

pub(super) fn router() -> Router<AppState> {
    Router::new()
        // 文件版本管理
        .route("/{id}/versions", get(list_file_versions_handler))
        .route("/versions/{version_id}", get(get_file_version_handler))
        .route(
            "/versions/{version_id}/download",
            get(download_file_version_handler),
        )
        .route(
            "/versions/{version_id}/preview",
            get(preview_file_version_handler),
        )
        .route(
            "/{id}/versions/{version_id}/diff",
            get(diff_file_version_handler),
        )
        .route(
            "/versions/{version_id}/label",
            put(update_version_label_handler),
        )
        .route(
            "/{id}/versions/{version_id}/restore",
            post(restore_version_handler),
        )
        .route("/versions/{version_id}", delete(delete_version_handler))
        .route("/{id}/tags", put(set_file_tags_handler))
        .route("/{id}/flags", patch(update_file_flags_handler))
}
