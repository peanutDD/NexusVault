use axum::{routing::get, Router};

use crate::handlers::activity::list_activity_handler;
use crate::AppState;

pub fn create_router() -> Router<AppState> {
    Router::new().route("/", get(list_activity_handler))
}
