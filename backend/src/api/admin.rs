use axum::routing::{get, post};
use axum::Router;

use crate::handlers;
use crate::AppState;

pub fn create_router() -> Router<AppState> {
    Router::new()
        .route("/tasks", get(handlers::admin::admin_list_tasks_handler))
        .route(
            "/tasks/:id/retry",
            post(handlers::admin::admin_retry_task_handler),
        )
}
