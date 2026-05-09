//! Trash handler integration tests.
//!
//! Uses the full Axum router and real PostgreSQL test database so route
//! ordering, auth extraction, and handler wiring are covered together.

mod common;

use axum::{
    body::{to_bytes, Body as AxumBody},
    http::StatusCode,
};
use common::{
    app::{bearer_auth_header, build_test_app, login_and_get_token},
    cleanup_test_data, create_test_file, create_test_pool, init_test_env,
};
use serde_json::Value;
use serial_test::serial;
use tower::ServiceExt;

async fn soft_delete_file(pool: &sqlx::PgPool, file_id: uuid::Uuid) {
    sqlx::query("UPDATE files SET deleted_at = NOW() WHERE id = $1")
        .bind(file_id)
        .execute(pool)
        .await
        .expect("failed to soft-delete test file");
}

#[tokio::test]
#[serial(trash_handler_db)]
async fn test_batch_trash_routes_reach_auth_instead_of_404() {
    init_test_env();
    let pool = create_test_pool().await;
    cleanup_test_data(&pool).await;
    let app = build_test_app(&pool).await;

    for path in [
        "/api/files/trash/batch-restore",
        "/api/files/trash/batch-permanent",
    ] {
        let response = app
            .clone()
            .oneshot(
                axum::http::Request::post(path)
                    .header("Content-Type", "application/json")
                    .body(AxumBody::from(r#"{"ids":[]}"#))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::UNAUTHORIZED, "{path}");
    }
}

#[tokio::test]
#[serial(trash_handler_db)]
async fn test_batch_restore_route_restores_deleted_files() {
    init_test_env();
    let pool = create_test_pool().await;
    cleanup_test_data(&pool).await;

    let (user_id, token) = login_and_get_token(&pool, "trash_batch_restore").await;
    let file_id = create_test_file(&pool, user_id, "restore-route.txt").await;
    soft_delete_file(&pool, file_id).await;
    let app = build_test_app(&pool).await;
    let (auth_name, auth_value) = bearer_auth_header(&token);

    let response = app
        .oneshot(
            axum::http::Request::post("/api/files/trash/batch-restore")
                .header("Content-Type", "application/json")
                .header(auth_name, auth_value)
                .body(AxumBody::from(format!(r#"{{"ids":["{file_id}"]}}"#)))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    let body = to_bytes(response.into_body(), 1024 * 1024).await.unwrap();
    let json: Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(json["restored"], 1);
    assert_eq!(json["failed"].as_array().unwrap().len(), 0);

    let deleted_at: Option<chrono::DateTime<chrono::Utc>> =
        sqlx::query_scalar("SELECT deleted_at FROM files WHERE id = $1")
            .bind(file_id)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert!(deleted_at.is_none());
}

#[tokio::test]
#[serial(trash_handler_db)]
async fn test_batch_permanent_route_deletes_only_trashed_files() {
    init_test_env();
    let pool = create_test_pool().await;
    cleanup_test_data(&pool).await;

    let (user_id, token) = login_and_get_token(&pool, "trash_batch_permanent").await;
    let deleted_id = create_test_file(&pool, user_id, "permanent-route.txt").await;
    let active_id = create_test_file(&pool, user_id, "active-route.txt").await;
    soft_delete_file(&pool, deleted_id).await;
    let app = build_test_app(&pool).await;
    let (auth_name, auth_value) = bearer_auth_header(&token);

    let response = app
        .oneshot(
            axum::http::Request::post("/api/files/trash/batch-permanent")
                .header("Content-Type", "application/json")
                .header(auth_name, auth_value)
                .body(AxumBody::from(format!(
                    r#"{{"ids":["{deleted_id}","{active_id}"]}}"#
                )))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    let body = to_bytes(response.into_body(), 1024 * 1024).await.unwrap();
    let json: Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(json["deleted"], 1);
    assert_eq!(json["failed"].as_array().unwrap().len(), 1);

    let deleted_exists: Option<uuid::Uuid> =
        sqlx::query_scalar("SELECT id FROM files WHERE id = $1")
            .bind(deleted_id)
            .fetch_optional(&pool)
            .await
            .unwrap();
    let active_exists: Option<uuid::Uuid> =
        sqlx::query_scalar("SELECT id FROM files WHERE id = $1")
            .bind(active_id)
            .fetch_optional(&pool)
            .await
            .unwrap();
    assert!(deleted_exists.is_none());
    assert_eq!(active_exists, Some(active_id));
}
