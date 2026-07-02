mod common;

use axum::{
    body::{to_bytes, Body},
    extract::ConnectInfo,
    http::{header, Method, Request, StatusCode},
};
use base64::{engine::general_purpose::STANDARD, Engine as _};
use file_storage_backend::{
    models::api_token::CreateApiTokenRequest, services::api_token::ApiTokenService,
};
use serial_test::serial;
use std::net::{Ipv4Addr, SocketAddr};
use tower::ServiceExt;
use uuid::Uuid;

use common::{app::build_test_app, cleanup_test_data, create_test_user, init_test_env};

async fn create_webdav_token(
    pool: &sqlx::PgPool,
    suffix: &str,
) -> (uuid::Uuid, String, String, String) {
    let (user_id, email, _) = create_test_user(pool, suffix).await;
    let token_service = ApiTokenService::new(
        pool.clone(),
        file_storage_backend::config::Config::default_for_test()
            .auth
            .api_token_hmac_secrets(),
    );
    let (token, _) = token_service
        .create_token(
            user_id,
            CreateApiTokenRequest {
                name: "dav".into(),
                expires_in_days: None,
                webdav_enabled: None,
                webdav_read_only: None,
                webdav_root_folder_id: None,
            },
        )
        .await
        .unwrap();
    let basic = format!("Basic {}", STANDARD.encode(format!("{email}:{token}")));
    (user_id, email, token, basic)
}

async fn create_webdav_token_for_user(
    pool: &sqlx::PgPool,
    user_id: uuid::Uuid,
    email: &str,
    name: &str,
) -> (String, String) {
    let token_service = ApiTokenService::new(
        pool.clone(),
        file_storage_backend::config::Config::default_for_test()
            .auth
            .api_token_hmac_secrets(),
    );
    let (token, _) = token_service
        .create_token(
            user_id,
            CreateApiTokenRequest {
                name: name.into(),
                expires_in_days: None,
                webdav_enabled: None,
                webdav_read_only: None,
                webdav_root_folder_id: None,
            },
        )
        .await
        .unwrap();
    let basic = format!("Basic {}", STANDARD.encode(format!("{email}:{token}")));
    (token, basic)
}

async fn create_named_webdav_token_for_user(
    pool: &sqlx::PgPool,
    user_id: uuid::Uuid,
    email: &str,
    name: &str,
    read_only: bool,
    root_folder_id: Option<Uuid>,
) -> (Uuid, String, String) {
    let token_service = ApiTokenService::new(
        pool.clone(),
        file_storage_backend::config::Config::default_for_test()
            .auth
            .api_token_hmac_secrets(),
    );
    let (token, api_token) = token_service
        .create_token(
            user_id,
            CreateApiTokenRequest {
                name: name.into(),
                expires_in_days: None,
                webdav_enabled: Some(true),
                webdav_read_only: Some(read_only),
                webdav_root_folder_id: root_folder_id,
            },
        )
        .await
        .unwrap();
    let basic = format!("Basic {}", STANDARD.encode(format!("{email}:{token}")));
    (api_token.id, token, basic)
}

#[tokio::test]
#[serial(webdav_handler_db)]
async fn webdav_basic_api_token_can_create_upload_list_and_range_download() {
    init_test_env();
    let pool = common::create_test_pool().await;
    cleanup_test_data(&pool).await;
    let app = build_test_app(&pool).await;
    let (user_id, email, _) = create_test_user(&pool, "webdav_basic").await;
    let token_service = ApiTokenService::new(
        pool.clone(),
        file_storage_backend::config::Config::default_for_test()
            .auth
            .api_token_hmac_secrets(),
    );
    let (token, _) = token_service
        .create_token(
            user_id,
            CreateApiTokenRequest {
                name: "dav".into(),
                expires_in_days: None,
                webdav_enabled: None,
                webdav_read_only: None,
                webdav_root_folder_id: None,
            },
        )
        .await
        .unwrap();
    let basic = format!("Basic {}", STANDARD.encode(format!("{email}:{token}")));

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("MKCOL")
                .uri("/dav/notes")
                .header(header::AUTHORIZATION, &basic)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::CREATED);

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::PUT)
                .uri("/dav/notes/hello.txt")
                .header(header::AUTHORIZATION, &basic)
                .header(header::CONTENT_TYPE, "text/plain")
                .body(Body::from("hello webdav"))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::CREATED);

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("PROPFIND")
                .uri("/dav/notes")
                .header(header::AUTHORIZATION, &basic)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::MULTI_STATUS);
    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let body = String::from_utf8_lossy(&body);
    assert!(body.contains("<D:href>/dav/notes/</D:href>"));
    assert!(body.contains("<D:status>HTTP/1.1 200 OK</D:status>"));
    assert!(body.contains("hello.txt"));

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("PROPFIND")
                .uri("/dav/notes/hello.txt")
                .header(header::AUTHORIZATION, &basic)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::MULTI_STATUS);
    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let body = String::from_utf8_lossy(&body);
    assert!(body.contains("<D:href>/dav/notes/hello.txt</D:href>"));
    assert!(body.contains("<D:getcontentlength>12</D:getcontentlength>"));

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri("/dav/notes/hello.txt")
                .header(header::AUTHORIZATION, &basic)
                .header(header::RANGE, "bytes=6-11")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::PARTIAL_CONTENT);
    assert_eq!(
        response.headers().get(header::CONTENT_RANGE).unwrap(),
        "bytes 6-11/12"
    );
    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    assert_eq!(&body[..], b"webdav");

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("LOCK")
                .uri("/dav/notes/hello.txt")
                .header(header::AUTHORIZATION, &basic)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    assert!(response.headers().get("lock-token").is_some());
}

#[tokio::test]
#[serial(webdav_handler_db)]
async fn webdav_wizard_endpoint_creates_read_write_token_for_90_days() {
    init_test_env();
    let pool = common::create_test_pool().await;
    cleanup_test_data(&pool).await;
    let app = build_test_app(&pool).await;
    let (_user_id, jwt) = common::app::login_and_get_token(&pool, "webdav_wizard_defaults").await;
    let (auth_name, auth_value) = common::app::bearer_auth_header(&jwt);

    let response = app
        .oneshot(
            Request::builder()
                .method(Method::POST)
                .uri("/api/v1/tokens/webdav-wizard")
                .header(auth_name, auth_value)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(json["token"]["webdav_enabled"], true);
    assert_eq!(json["token"]["webdav_read_only"], false);
    assert!(json["token"]["token"].as_str().unwrap().len() >= 32);
    let expires_at = json["token"]["expires_at"].as_str().unwrap();
    assert!(!expires_at.is_empty());
}

#[tokio::test]
#[serial(webdav_handler_db)]
async fn webdav_wizard_accepts_device_name_and_mode() {
    init_test_env();
    let pool = common::create_test_pool().await;
    cleanup_test_data(&pool).await;
    let app = build_test_app(&pool).await;
    let (_user_id, jwt) = common::app::login_and_get_token(&pool, "webdav_wizard_named").await;
    let (auth_name, auth_value) = common::app::bearer_auth_header(&jwt);

    let response = app
        .oneshot(
            Request::builder()
                .method(Method::POST)
                .uri("/api/v1/tokens/webdav-wizard")
                .header(auth_name, auth_value)
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(
                    r#"{"name":"MacBook Finder","webdav_read_only":true}"#,
                ))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(json["token"]["name"], "MacBook Finder");
    assert_eq!(json["token"]["webdav_enabled"], true);
    assert_eq!(json["token"]["webdav_read_only"], true);
    assert!(json["token"]["token"].as_str().unwrap().len() >= 32);
}

#[tokio::test]
#[serial(webdav_handler_db)]
async fn webdav_wizard_and_activity_are_available_on_unversioned_api_prefix() {
    init_test_env();
    let pool = common::create_test_pool().await;
    cleanup_test_data(&pool).await;
    let app = build_test_app(&pool).await;
    let (_user_id, jwt) =
        common::app::login_and_get_token(&pool, "webdav_unversioned_prefix").await;
    let (auth_name, auth_value) = common::app::bearer_auth_header(&jwt);

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::POST)
                .uri("/api/tokens/webdav-wizard")
                .header(auth_name.clone(), auth_value.clone())
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    let response = app
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri("/api/tokens/webdav-activity")
                .header(auth_name, auth_value)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
#[serial(webdav_handler_db)]
async fn webdav_activity_records_successful_requests_without_secrets() {
    init_test_env();
    let pool = common::create_test_pool().await;
    cleanup_test_data(&pool).await;
    let app = build_test_app(&pool).await;
    let (user_id, email, token, basic) = create_webdav_token(&pool, "webdav_activity").await;
    let jwt = {
        let config = file_storage_backend::config::Config::default_for_test();
        let auth_service = file_storage_backend::services::auth::AuthService::new(
            std::sync::Arc::new(file_storage_backend::repositories::SqlxUsersRepo::new(
                pool.clone(),
            )),
            config,
            file_storage_backend::services::cache::CacheService::new(),
            None,
        );
        auth_service.generate_token(&user_id).unwrap()
    };

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("PROPFIND")
                .uri("/dav/")
                .header(header::AUTHORIZATION, &basic)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::MULTI_STATUS);

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("PROPFIND")
                .uri("/dav/")
                .header(header::AUTHORIZATION, "Basic invalid")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);

    let (auth_name, auth_value) = common::app::bearer_auth_header(&jwt);
    let response = app
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri("/api/v1/tokens/webdav-activity")
                .header(auth_name, auth_value)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
    let events = json["events"].as_array().unwrap();
    assert_eq!(events.len(), 1);
    assert_eq!(events[0]["method"], "PROPFIND");
    assert_eq!(events[0]["status_code"], 207);
    assert_eq!(events[0]["path"], "/");
    assert_eq!(events[0]["read_only"], false);
    let rendered = String::from_utf8_lossy(&body);
    assert!(!rendered.contains(&token));
    assert!(!rendered.contains(&email));
    assert!(!rendered.contains("Authorization"));
}

#[tokio::test]
#[serial(webdav_handler_db)]
async fn webdav_diagnostics_aggregate_token_activity_and_client_metadata() {
    init_test_env();
    let pool = common::create_test_pool().await;
    cleanup_test_data(&pool).await;
    let app = build_test_app(&pool).await;
    let (user_id, email, _) = create_test_user(&pool, "webdav_diag_owner").await;
    let (_, jwt) = common::app::login_and_get_token(&pool, "webdav_diag_viewer").await;
    let owner_jwt = {
        let config = file_storage_backend::config::Config::default_for_test();
        let auth_service = file_storage_backend::services::auth::AuthService::new(
            std::sync::Arc::new(file_storage_backend::repositories::SqlxUsersRepo::new(
                pool.clone(),
            )),
            config,
            file_storage_backend::services::cache::CacheService::new(),
            None,
        );
        auth_service.generate_token(&user_id).unwrap()
    };
    let (token_id, token, basic) =
        create_named_webdav_token_for_user(&pool, user_id, &email, "MacBook Finder", false, None)
            .await;

    let mut request = Request::builder()
        .method("PROPFIND")
        .uri("/dav/")
        .header(header::AUTHORIZATION, &basic)
        .header(header::USER_AGENT, "Finder/15.0")
        .body(Body::empty())
        .unwrap();
    request
        .extensions_mut()
        .insert(ConnectInfo(SocketAddr::from((
            Ipv4Addr::new(203, 0, 113, 7),
            4242,
        ))));
    let response = app.clone().oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::MULTI_STATUS);

    let mut request = Request::builder()
        .method(Method::PUT)
        .uri("/dav/sync.txt")
        .header(header::AUTHORIZATION, &basic)
        .header(header::USER_AGENT, "Finder/15.0")
        .body(Body::from("sync"))
        .unwrap();
    request
        .extensions_mut()
        .insert(ConnectInfo(SocketAddr::from((
            Ipv4Addr::new(203, 0, 113, 7),
            4242,
        ))));
    let response = app.clone().oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::CREATED);

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::PUT)
                .uri("/dav/unauthorized.txt")
                .header(header::AUTHORIZATION, "Basic invalid")
                .header(header::USER_AGENT, "ShouldNotAttach")
                .body(Body::from("nope"))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);

    let (auth_name, auth_value) = common::app::bearer_auth_header(&owner_jwt);
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri("/api/v1/tokens/webdav-diagnostics")
                .header(auth_name, auth_value)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
    let diagnostics = json["diagnostics"].as_array().unwrap();
    let token_row = diagnostics
        .iter()
        .find(|row| row["token_id"] == token_id.to_string())
        .unwrap();

    assert_eq!(token_row["token_name"], "MacBook Finder");
    assert_eq!(token_row["last_ip"], "203.0.113.7");
    assert_eq!(token_row["last_user_agent"], "Finder/15.0");
    assert_eq!(token_row["read_count"], 1);
    assert_eq!(token_row["write_count"], 1);
    assert_eq!(token_row["status_buckets"]["2xx"], 2);
    assert_eq!(token_row["status_buckets"]["401"], 0);

    let rendered = String::from_utf8_lossy(&body);
    assert!(!rendered.contains(&token));
    assert!(!rendered.contains("Authorization"));

    let (other_auth_name, other_auth_value) = common::app::bearer_auth_header(&jwt);
    let response = app
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri("/api/v1/tokens/webdav-diagnostics")
                .header(other_auth_name, other_auth_value)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let other_body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let other_json: serde_json::Value = serde_json::from_slice(&other_body).unwrap();
    assert!(other_json["diagnostics"].as_array().unwrap().is_empty());
}

#[tokio::test]
#[serial(webdav_handler_db)]
async fn api_token_patch_updates_owned_webdav_metadata_only() {
    init_test_env();
    let pool = common::create_test_pool().await;
    cleanup_test_data(&pool).await;
    let app = build_test_app(&pool).await;
    let (owner_id, owner_email, _) = create_test_user(&pool, "webdav_patch_owner").await;
    let (other_id, _) = common::app::login_and_get_token(&pool, "webdav_patch_other").await;
    let owner_jwt = {
        let config = file_storage_backend::config::Config::default_for_test();
        let auth_service = file_storage_backend::services::auth::AuthService::new(
            std::sync::Arc::new(file_storage_backend::repositories::SqlxUsersRepo::new(
                pool.clone(),
            )),
            config,
            file_storage_backend::services::cache::CacheService::new(),
            None,
        );
        auth_service.generate_token(&owner_id).unwrap()
    };
    let root_folder_id = common::create_test_folder(&pool, owner_id, "DavRoot", None).await;
    let other_folder_id = common::create_test_folder(&pool, other_id, "OtherRoot", None).await;
    let (token_id, _token, _basic) =
        create_named_webdav_token_for_user(&pool, owner_id, &owner_email, "Old token", false, None)
            .await;

    let (auth_name, auth_value) = common::app::bearer_auth_header(&owner_jwt);
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::PATCH)
                .uri(format!("/api/v1/tokens/{token_id}"))
                .header(auth_name.clone(), auth_value.clone())
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(format!(
                    r#"{{"name":"iPhone Files","webdav_enabled":true,"webdav_read_only":true,"webdav_root_folder_id":"{root_folder_id}"}}"#
                )))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(json["token"]["name"], "iPhone Files");
    assert_eq!(json["token"]["webdav_read_only"], true);
    assert_eq!(
        json["token"]["webdav_root_folder_id"],
        root_folder_id.to_string()
    );
    assert!(json["token"].get("token").is_none());

    let response = app
        .oneshot(
            Request::builder()
                .method(Method::PATCH)
                .uri(format!("/api/v1/tokens/{token_id}"))
                .header(auth_name, auth_value)
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(format!(
                    r#"{{"webdav_root_folder_id":"{other_folder_id}"}}"#
                )))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
#[serial(webdav_handler_db)]
async fn webdav_rejects_login_password_and_path_traversal() {
    init_test_env();
    let pool = common::create_test_pool().await;
    cleanup_test_data(&pool).await;
    let app = build_test_app(&pool).await;
    let (_, email, password) = create_test_user(&pool, "webdav_reject").await;
    let basic = format!("Basic {}", STANDARD.encode(format!("{email}:{password}")));

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("PROPFIND")
                .uri("/dav/")
                .header(header::AUTHORIZATION, basic)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);

    let response = app
        .oneshot(
            Request::builder()
                .method("PROPFIND")
                .uri("/dav/%2e%2e")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
#[serial(webdav_handler_db)]
async fn webdav_put_ignores_macos_appledouble_files() {
    init_test_env();
    let pool = common::create_test_pool().await;
    cleanup_test_data(&pool).await;
    let app = build_test_app(&pool).await;
    let (user_id, _, _, basic) = create_webdav_token(&pool, "webdav_appledouble").await;

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::PUT)
                .uri("/dav/._photo.jpg")
                .header(header::AUTHORIZATION, &basic)
                .header(header::CONTENT_TYPE, "application/octet-stream")
                .body(Body::from("macos resource fork"))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::NO_CONTENT);

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("PROPFIND")
                .uri("/dav/")
                .header(header::AUTHORIZATION, &basic)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::MULTI_STATUS);
    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let body = String::from_utf8_lossy(&body);
    assert!(!body.contains("._photo.jpg"));

    let count: (i64,) = sqlx::query_as(
        "SELECT COUNT(*)::BIGINT FROM files WHERE user_id = $1 AND original_filename = $2",
    )
    .bind(user_id)
    .bind("._photo.jpg")
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(count.0, 0);
}

#[tokio::test]
#[serial(webdav_handler_db)]
async fn webdav_ignores_finder_ds_store_files() {
    init_test_env();
    let pool = common::create_test_pool().await;
    cleanup_test_data(&pool).await;
    let app = build_test_app(&pool).await;
    let (user_id, _, _, basic) = create_webdav_token(&pool, "webdav_ds_store").await;

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::PUT)
                .uri("/dav/.DS_Store")
                .header(header::AUTHORIZATION, &basic)
                .body(Body::from("finder metadata"))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::NO_CONTENT);

    let count: (i64,) = sqlx::query_as(
        "SELECT COUNT(*)::BIGINT FROM files WHERE user_id = $1 AND original_filename = $2",
    )
    .bind(user_id)
    .bind(".DS_Store")
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(count.0, 0);
}

#[tokio::test]
#[serial(webdav_handler_db)]
async fn webdav_propfind_depth_zero_only_returns_requested_resource() {
    init_test_env();
    let pool = common::create_test_pool().await;
    cleanup_test_data(&pool).await;
    let app = build_test_app(&pool).await;
    let (_, _, _, basic) = create_webdav_token(&pool, "webdav_depth0").await;

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("MKCOL")
                .uri("/dav/notes")
                .header(header::AUTHORIZATION, &basic)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::CREATED);

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::PUT)
                .uri("/dav/notes/child.txt")
                .header(header::AUTHORIZATION, &basic)
                .body(Body::from("child"))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::CREATED);

    let response = app
        .oneshot(
            Request::builder()
                .method("PROPFIND")
                .uri("/dav/notes")
                .header(header::AUTHORIZATION, &basic)
                .header("depth", "0")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::MULTI_STATUS);
    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let body = String::from_utf8_lossy(&body);
    assert!(body.contains("<D:href>/dav/notes/</D:href>"));
    assert!(!body.contains("child.txt"));
}

#[tokio::test]
#[serial(webdav_handler_db)]
async fn webdav_propfind_unknown_prop_returns_404_propstat() {
    init_test_env();
    let pool = common::create_test_pool().await;
    cleanup_test_data(&pool).await;
    let app = build_test_app(&pool).await;
    let (_, _, _, basic) = create_webdav_token(&pool, "webdav_propfind_unknown").await;

    let response = app
        .oneshot(
            Request::builder()
                .method("PROPFIND")
                .uri("/dav")
                .header(header::AUTHORIZATION, &basic)
                .header("depth", "0")
                .body(Body::from(
                    r#"<?xml version="1.0"?><D:propfind xmlns:D="DAV:"><D:prop><D:displayname/><D:unknownprop/></D:prop></D:propfind>"#,
                ))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::MULTI_STATUS);
    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let body = String::from_utf8_lossy(&body);
    assert!(body.contains("<D:displayname>dav</D:displayname>"));
    assert!(body.contains("<D:unknownprop/>"));
    assert!(body.contains("HTTP/1.1 404 Not Found"));
}

#[tokio::test]
#[serial(webdav_handler_db)]
async fn webdav_propfind_rejects_malformed_xml() {
    init_test_env();
    let pool = common::create_test_pool().await;
    cleanup_test_data(&pool).await;
    let app = build_test_app(&pool).await;
    let (_, _, _, basic) = create_webdav_token(&pool, "webdav_propfind_malformed").await;

    let response = app
        .oneshot(
            Request::builder()
                .method("PROPFIND")
                .uri("/dav")
                .header(header::AUTHORIZATION, &basic)
                .header("depth", "0")
                .body(Body::from(
                    r#"<?xml version="1.0"?><D:propfind xmlns:D="DAV:"><D:prop><D:displayname/>"#,
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
#[serial(webdav_handler_db)]
async fn webdav_propfind_ignores_properties_inside_xml_comments() {
    init_test_env();
    let pool = common::create_test_pool().await;
    cleanup_test_data(&pool).await;
    let app = build_test_app(&pool).await;
    let (_, _, _, basic) = create_webdav_token(&pool, "webdav_propfind_comments").await;

    let response = app
        .oneshot(
            Request::builder()
                .method("PROPFIND")
                .uri("/dav")
                .header(header::AUTHORIZATION, &basic)
                .header("depth", "0")
                .body(Body::from(
                    r#"<?xml version="1.0"?><Z:propfind xmlns:Z="DAV:"><Z:prop><!-- <Z:getcontentlength/> --><Z:displayname/></Z:prop></Z:propfind>"#,
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::MULTI_STATUS);
    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let body = String::from_utf8_lossy(&body);
    assert!(body.contains("<D:displayname>dav</D:displayname>"));
    assert!(!body.contains("<D:getcontentlength>"));
}

#[tokio::test]
#[serial(webdav_handler_db)]
async fn webdav_propfind_depth_infinity_recurses_children() {
    init_test_env();
    let pool = common::create_test_pool().await;
    cleanup_test_data(&pool).await;
    let app = build_test_app(&pool).await;
    let (_, _, _, basic) = create_webdav_token(&pool, "webdav_depth_infinity").await;

    for path in ["/dav/archive", "/dav/archive/nested"] {
        let response = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("MKCOL")
                    .uri(path)
                    .header(header::AUTHORIZATION, &basic)
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::CREATED);
    }
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::PUT)
                .uri("/dav/archive/nested/deep.txt")
                .header(header::AUTHORIZATION, &basic)
                .body(Body::from("deep"))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::CREATED);

    let response = app
        .oneshot(
            Request::builder()
                .method("PROPFIND")
                .uri("/dav/archive")
                .header(header::AUTHORIZATION, &basic)
                .header("depth", "infinity")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::MULTI_STATUS);
    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let body = String::from_utf8_lossy(&body);
    assert!(body.contains("<D:href>/dav/archive/nested/</D:href>"));
    assert!(body.contains("<D:href>/dav/archive/nested/deep.txt</D:href>"));
}

#[tokio::test]
#[serial(webdav_handler_db)]
async fn webdav_suffix_range_returns_tail_bytes() {
    init_test_env();
    let pool = common::create_test_pool().await;
    cleanup_test_data(&pool).await;
    let app = build_test_app(&pool).await;
    let (_, _, _, basic) = create_webdav_token(&pool, "webdav_suffix_range").await;

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::PUT)
                .uri("/dav/range.txt")
                .header(header::AUTHORIZATION, &basic)
                .body(Body::from("hello webdav"))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::CREATED);

    let response = app
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri("/dav/range.txt")
                .header(header::AUTHORIZATION, &basic)
                .header(header::RANGE, "bytes=-6")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::PARTIAL_CONTENT);
    assert_eq!(
        response.headers().get(header::CONTENT_RANGE).unwrap(),
        "bytes 6-11/12"
    );
    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    assert_eq!(&body[..], b"webdav");
}

#[tokio::test]
#[serial(webdav_handler_db)]
async fn webdav_lock_blocks_write_without_matching_token() {
    init_test_env();
    let pool = common::create_test_pool().await;
    cleanup_test_data(&pool).await;
    let app = build_test_app(&pool).await;
    let (_, _, _, basic) = create_webdav_token(&pool, "webdav_real_lock").await;

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::PUT)
                .uri("/dav/locked.txt")
                .header(header::AUTHORIZATION, &basic)
                .body(Body::from("first"))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::CREATED);

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("LOCK")
                .uri("/dav/locked.txt")
                .header(header::AUTHORIZATION, &basic)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let lock_token = response
        .headers()
        .get("lock-token")
        .unwrap()
        .to_str()
        .unwrap()
        .trim_matches(['<', '>'])
        .to_string();

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::PUT)
                .uri("/dav/locked.txt")
                .header(header::AUTHORIZATION, &basic)
                .body(Body::from("second"))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status().as_u16(), 423);

    let response = app
        .oneshot(
            Request::builder()
                .method(Method::PUT)
                .uri("/dav/locked.txt")
                .header(header::AUTHORIZATION, &basic)
                .header("if", format!("(<{lock_token}>)"))
                .body(Body::from("second"))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::CREATED);
}

#[tokio::test]
#[serial(webdav_handler_db)]
async fn webdav_lock_refresh_reuses_existing_token() {
    init_test_env();
    let pool = common::create_test_pool().await;
    cleanup_test_data(&pool).await;
    let app = build_test_app(&pool).await;
    let (user_id, _, _, basic) = create_webdav_token(&pool, "webdav_lock_refresh").await;

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("LOCK")
                .uri("/dav/refresh.txt")
                .header(header::AUTHORIZATION, &basic)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let lock_token = response
        .headers()
        .get("lock-token")
        .unwrap()
        .to_str()
        .unwrap()
        .trim_matches(['<', '>'])
        .to_string();

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("LOCK")
                .uri("/dav/refresh.txt")
                .header(header::AUTHORIZATION, &basic)
                .header("if", format!("(<{lock_token}>)"))
                .header("timeout", "Second-1200")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(
        response
            .headers()
            .get("lock-token")
            .unwrap()
            .to_str()
            .unwrap(),
        format!("<{lock_token}>")
    );

    let count: (i64,) =
        sqlx::query_as("SELECT COUNT(*)::BIGINT FROM webdav_locks WHERE user_id = $1")
            .bind(user_id)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(count.0, 1);
}

#[tokio::test]
#[serial(webdav_handler_db)]
async fn webdav_unlock_requires_same_api_token() {
    init_test_env();
    let pool = common::create_test_pool().await;
    cleanup_test_data(&pool).await;
    let app = build_test_app(&pool).await;
    let (user_id, email, _, first_basic) = create_webdav_token(&pool, "webdav_unlock_owner").await;
    let (_, second_basic) =
        create_webdav_token_for_user(&pool, user_id, &email, "second dav token").await;

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("LOCK")
                .uri("/dav/owned-lock.txt")
                .header(header::AUTHORIZATION, &first_basic)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let lock_token = response
        .headers()
        .get("lock-token")
        .unwrap()
        .to_str()
        .unwrap()
        .to_string();

    let response = app
        .oneshot(
            Request::builder()
                .method("UNLOCK")
                .uri("/dav/owned-lock.txt")
                .header(header::AUTHORIZATION, &second_basic)
                .header("lock-token", lock_token)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::NOT_FOUND);

    let count: (i64,) =
        sqlx::query_as("SELECT COUNT(*)::BIGINT FROM webdav_locks WHERE user_id = $1")
            .bind(user_id)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(count.0, 1);
}

#[tokio::test]
#[serial(webdav_handler_db)]
async fn webdav_read_only_token_rejects_write_methods() {
    init_test_env();
    let pool = common::create_test_pool().await;
    cleanup_test_data(&pool).await;
    let app = build_test_app(&pool).await;
    let (user_id, email, _) = create_test_user(&pool, "webdav_read_only").await;
    let token_service = ApiTokenService::new(
        pool.clone(),
        file_storage_backend::config::Config::default_for_test()
            .auth
            .api_token_hmac_secrets(),
    );
    let (token, _) = token_service
        .create_token(
            user_id,
            CreateApiTokenRequest {
                name: "readonly dav".into(),
                expires_in_days: None,
                webdav_enabled: Some(true),
                webdav_read_only: Some(true),
                webdav_root_folder_id: None,
            },
        )
        .await
        .unwrap();
    let basic = format!("Basic {}", STANDARD.encode(format!("{email}:{token}")));

    let response = app
        .oneshot(
            Request::builder()
                .method(Method::PUT)
                .uri("/dav/blocked.txt")
                .header(header::AUTHORIZATION, &basic)
                .body(Body::from("blocked"))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::FORBIDDEN);
}

#[tokio::test]
#[serial(webdav_handler_db)]
async fn webdav_delete_folder_soft_deletes_child_files() {
    init_test_env();
    let pool = common::create_test_pool().await;
    cleanup_test_data(&pool).await;
    let app = build_test_app(&pool).await;
    let (user_id, _, _, basic) = create_webdav_token(&pool, "webdav_delete_folder").await;

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("MKCOL")
                .uri("/dav/archive")
                .header(header::AUTHORIZATION, &basic)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::CREATED);

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::PUT)
                .uri("/dav/archive/note.txt")
                .header(header::AUTHORIZATION, &basic)
                .body(Body::from("note"))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::CREATED);

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::DELETE)
                .uri("/dav/archive")
                .header(header::AUTHORIZATION, &basic)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::NO_CONTENT);

    let deleted_at: (Option<chrono::DateTime<chrono::Utc>>,) = sqlx::query_as(
        "SELECT deleted_at FROM files WHERE user_id = $1 AND original_filename = $2",
    )
    .bind(user_id)
    .bind("note.txt")
    .fetch_one(&pool)
    .await
    .unwrap();
    assert!(deleted_at.0.is_some());
}

#[tokio::test]
#[serial(webdav_handler_db)]
async fn webdav_copy_file_creates_destination_file() {
    init_test_env();
    let pool = common::create_test_pool().await;
    cleanup_test_data(&pool).await;
    let app = build_test_app(&pool).await;
    let (user_id, _, _, basic) = create_webdav_token(&pool, "webdav_copy_file").await;

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::PUT)
                .uri("/dav/source.txt")
                .header(header::AUTHORIZATION, &basic)
                .body(Body::from("copy me"))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::CREATED);

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("COPY")
                .uri("/dav/source.txt")
                .header(header::AUTHORIZATION, &basic)
                .header("destination", "http://localhost/dav/copied.txt")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::CREATED);

    let count: (i64,) = sqlx::query_as(
        "SELECT COUNT(*)::BIGINT FROM files WHERE user_id = $1 AND original_filename = $2 AND deleted_at IS NULL",
    )
    .bind(user_id)
    .bind("copied.txt")
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(count.0, 1);
}

#[tokio::test]
#[serial(webdav_handler_db)]
async fn webdav_copy_overwrite_false_rejects_conflict() {
    init_test_env();
    let pool = common::create_test_pool().await;
    cleanup_test_data(&pool).await;
    let app = build_test_app(&pool).await;
    let (user_id, _, _, basic) = create_webdav_token(&pool, "webdav_copy_overwrite").await;

    for (path, body) in [
        ("/dav/source.txt", "source"),
        ("/dav/copied.txt", "existing"),
    ] {
        let response = app
            .clone()
            .oneshot(
                Request::builder()
                    .method(Method::PUT)
                    .uri(path)
                    .header(header::AUTHORIZATION, &basic)
                    .body(Body::from(body))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::CREATED);
    }

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("COPY")
                .uri("/dav/source.txt")
                .header(header::AUTHORIZATION, &basic)
                .header("destination", "http://localhost/dav/copied.txt")
                .header("overwrite", "F")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::PRECONDITION_FAILED);

    let count: (i64,) = sqlx::query_as(
        "SELECT COUNT(*)::BIGINT FROM files WHERE user_id = $1 AND original_filename = $2 AND deleted_at IS NULL",
    )
    .bind(user_id)
    .bind("copied.txt")
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(count.0, 1);
}

#[tokio::test]
#[serial(webdav_handler_db)]
async fn webdav_copy_folder_recursively_copies_children() {
    init_test_env();
    let pool = common::create_test_pool().await;
    cleanup_test_data(&pool).await;
    let app = build_test_app(&pool).await;
    let (user_id, _, _, basic) = create_webdav_token(&pool, "webdav_copy_folder").await;

    for path in ["/dav/archive", "/dav/archive/nested"] {
        let response = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("MKCOL")
                    .uri(path)
                    .header(header::AUTHORIZATION, &basic)
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::CREATED);
    }

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::PUT)
                .uri("/dav/archive/nested/note.txt")
                .header(header::AUTHORIZATION, &basic)
                .body(Body::from("nested note"))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::CREATED);

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("COPY")
                .uri("/dav/archive")
                .header(header::AUTHORIZATION, &basic)
                .header("destination", "http://localhost/dav/archive-copy")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::CREATED);

    let count: (i64,) = sqlx::query_as(
        r#"
        SELECT COUNT(*)::BIGINT
        FROM files f
        JOIN folders nested ON f.folder_id = nested.id
        JOIN folders copied_root ON nested.parent_id = copied_root.id
        WHERE f.user_id = $1
          AND f.original_filename = 'note.txt'
          AND f.deleted_at IS NULL
          AND nested.name = 'nested'
          AND copied_root.name = 'archive-copy'
        "#,
    )
    .bind(user_id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(count.0, 1);
}

#[tokio::test]
#[serial(webdav_handler_db)]
async fn api_file_list_omits_missing_local_storage_records() {
    init_test_env();
    let pool = common::create_test_pool().await;
    cleanup_test_data(&pool).await;
    let app = build_test_app(&pool).await;
    let (user_id, _, token, basic) = create_webdav_token(&pool, "webdav_orphan").await;

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::PUT)
                .uri("/dav/orphaned-image.jpg")
                .header(header::AUTHORIZATION, &basic)
                .header(header::CONTENT_TYPE, "image/jpeg")
                .body(Body::from("jpeg bytes"))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::CREATED);

    let (file_path,): (String,) =
        sqlx::query_as("SELECT file_path FROM files WHERE user_id = $1 AND original_filename = $2")
            .bind(user_id)
            .bind("orphaned-image.jpg")
            .fetch_one(&pool)
            .await
            .unwrap();
    tokio::fs::remove_file(&file_path).await.unwrap();

    let response = app
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri("/api/v1/files?limit=50")
                .header(header::AUTHORIZATION, format!("Bearer {token}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let body = String::from_utf8_lossy(&body);
    assert!(!body.contains("orphaned-image.jpg"));
}

#[tokio::test]
#[serial(webdav_handler_db)]
async fn webdav_move_accepts_reverse_proxy_destination_prefix() {
    init_test_env();
    let pool = common::create_test_pool().await;
    cleanup_test_data(&pool).await;
    let app = build_test_app(&pool).await;
    let (_, _, _, basic) = create_webdav_token(&pool, "webdav_move_proxy_destination").await;

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::PUT)
                .uri("/dav/source.txt")
                .header(header::AUTHORIZATION, &basic)
                .header(header::CONTENT_TYPE, "text/plain")
                .body(Body::from("proxied destination"))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::CREATED);

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("MOVE")
                .uri("/dav/source.txt")
                .header(header::AUTHORIZATION, &basic)
                .header(
                    "destination",
                    "https://files.example.test/proxy/prefix/dav/moved%20file.txt",
                )
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::CREATED);

    let response = app
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri("/dav/moved%20file.txt")
                .header(header::AUTHORIZATION, &basic)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
#[serial(webdav_handler_db)]
async fn webdav_copy_accepts_relative_destination_path() {
    init_test_env();
    let pool = common::create_test_pool().await;
    cleanup_test_data(&pool).await;
    let app = build_test_app(&pool).await;
    let (_, _, _, basic) = create_webdav_token(&pool, "webdav_copy_relative_destination").await;

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::PUT)
                .uri("/dav/source.txt")
                .header(header::AUTHORIZATION, &basic)
                .header(header::CONTENT_TYPE, "text/plain")
                .body(Body::from("relative destination"))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::CREATED);

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("COPY")
                .uri("/dav/source.txt")
                .header(header::AUTHORIZATION, &basic)
                .header("destination", "copied-relative.txt")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::CREATED);

    let response = app
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri("/dav/copied-relative.txt")
                .header(header::AUTHORIZATION, &basic)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
#[serial(webdav_handler_db)]
async fn webdav_move_accepts_relative_destination_in_source_collection() {
    init_test_env();
    let pool = common::create_test_pool().await;
    cleanup_test_data(&pool).await;
    let app = build_test_app(&pool).await;
    let (_, _, _, basic) = create_webdav_token(&pool, "webdav_move_relative_collection").await;

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("MKCOL")
                .uri("/dav/relative-folder")
                .header(header::AUTHORIZATION, &basic)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::CREATED);

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::PUT)
                .uri("/dav/relative-folder/source.txt")
                .header(header::AUTHORIZATION, &basic)
                .header(header::CONTENT_TYPE, "text/plain")
                .body(Body::from("same collection"))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::CREATED);

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("MOVE")
                .uri("/dav/relative-folder/source.txt")
                .header(header::AUTHORIZATION, &basic)
                .header("destination", "renamed.txt")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::CREATED);

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri("/dav/renamed.txt")
                .header(header::AUTHORIZATION, &basic)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::NOT_FOUND);

    let response = app
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri("/dav/relative-folder/renamed.txt")
                .header(header::AUTHORIZATION, &basic)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
#[serial(webdav_handler_db)]
async fn webdav_put_infers_previewable_mime_from_filename() {
    init_test_env();
    let pool = common::create_test_pool().await;
    cleanup_test_data(&pool).await;
    let app = build_test_app(&pool).await;
    let (user_id, email, _) = create_test_user(&pool, "webdav_mime").await;
    let token_service = ApiTokenService::new(
        pool.clone(),
        file_storage_backend::config::Config::default_for_test()
            .auth
            .api_token_hmac_secrets(),
    );
    let (token, _) = token_service
        .create_token(
            user_id,
            CreateApiTokenRequest {
                name: "dav".into(),
                expires_in_days: None,
                webdav_enabled: None,
                webdav_read_only: None,
                webdav_root_folder_id: None,
            },
        )
        .await
        .unwrap();
    let basic = format!("Basic {}", STANDARD.encode(format!("{email}:{token}")));

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::PUT)
                .uri("/dav/finder-image.png")
                .header(header::AUTHORIZATION, &basic)
                .header(header::CONTENT_TYPE, "application/octet-stream")
                .body(Body::from("png-bytes"))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::CREATED);

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("PROPFIND")
                .uri("/dav/finder-image.png")
                .header(header::AUTHORIZATION, &basic)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::MULTI_STATUS);
    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let body = String::from_utf8_lossy(&body);
    assert!(body.contains("<D:getcontenttype>image/png</D:getcontenttype>"));

    let response = app
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri("/dav/finder-image.png")
                .header(header::AUTHORIZATION, &basic)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(
        response.headers().get(header::CONTENT_TYPE).unwrap(),
        "image/png"
    );
}

#[tokio::test]
#[serial(webdav_handler_db)]
async fn api_preview_infers_mime_for_legacy_octet_stream_metadata() {
    init_test_env();
    let pool = common::create_test_pool().await;
    cleanup_test_data(&pool).await;
    let app = build_test_app(&pool).await;
    let (user_id, email, _) = create_test_user(&pool, "legacy_preview_mime").await;
    let token_service = ApiTokenService::new(
        pool.clone(),
        file_storage_backend::config::Config::default_for_test()
            .auth
            .api_token_hmac_secrets(),
    );
    let (token, _) = token_service
        .create_token(
            user_id,
            CreateApiTokenRequest {
                name: "dav".into(),
                expires_in_days: None,
                webdav_enabled: None,
                webdav_read_only: None,
                webdav_root_folder_id: None,
            },
        )
        .await
        .unwrap();
    let basic = format!("Basic {}", STANDARD.encode(format!("{email}:{token}")));

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::PUT)
                .uri("/dav/legacy-image.png")
                .header(header::AUTHORIZATION, &basic)
                .header(header::CONTENT_TYPE, "image/png")
                .body(Body::from("png-bytes"))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::CREATED);

    let (file_id,): (uuid::Uuid,) =
        sqlx::query_as("SELECT id FROM files WHERE user_id = $1 AND original_filename = $2")
            .bind(user_id)
            .bind("legacy-image.png")
            .fetch_one(&pool)
            .await
            .unwrap();
    sqlx::query("UPDATE files SET mime_type = 'application/octet-stream' WHERE id = $1")
        .bind(file_id)
        .execute(&pool)
        .await
        .unwrap();

    let response = app
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri(format!("/api/v1/files/{file_id}/preview"))
                .header(header::AUTHORIZATION, format!("Bearer {token}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(
        response.headers().get(header::CONTENT_TYPE).unwrap(),
        "image/png"
    );
}
