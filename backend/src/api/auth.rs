use axum::routing::{get, post, put};
use axum::Router;

use crate::handlers::auth::{change_password_handler, login_handler, me_handler, register_handler};

pub fn create_router() -> Router {
    Router::new()
        .route("/register", post(register_handler))
        .route("/login", post(login_handler))
        .route("/me", get(me_handler))
        .route("/change-password", put(change_password_handler))
}
