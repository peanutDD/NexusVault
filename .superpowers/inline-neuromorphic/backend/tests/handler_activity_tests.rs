mod common;

use axum::{
    body::{to_bytes, Body as AxumBody},
    http::StatusCode,
};
use common::{
    app::{bearer_auth_header, build_test_app, login_and_get_token},
    cleanup_test_data, create_test_file, create_test_pool, create_test_user, init_test_env,
};
use file_storage_backend::repositories::audit_events::{AuditEventsRepo, CreateAuditEvent};
use serde_json::json;
use serial_test::serial;
use tower::ServiceExt;
use uuid::Uuid;

async fn json_body(response: axum::response::Response) -> serde_json::Value {
    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    serde_json::from_slice(&body).unwrap()
}

fn multipart_body(boundary: &str, filename: &str, content: &str) -> String {
    format!(
        "--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{filename}\"\r\nContent-Type: text/plain\r\n\r\n{content}\r\n--{boundary}--\r\n"
    )
}

async fn activity_events(app: &axum::Router, token: &str, query: &str) -> serde_json::Value {
    let (auth_name, auth_value) = bearer_auth_header(token);
    let response = app
        .clone()
        .oneshot(
            axum::http::Request::get(format!("/api/v1/activity?{query}"))
                .header(auth_name, auth_value)
                .body(AxumBody::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    json_body(response).await
}

#[tokio::test]
#[serial(activity_db)]
async fn activity_feed_is_user_scoped_filterable_and_cursor_paginated() {
    init_test_env();
    let pool = create_test_pool().await;
    cleanup_test_data(&pool).await;
    let (owner_id, token) = login_and_get_token(&pool, "activity_owner").await;
    let (other_id, _, _) = create_test_user(&pool, "activity_other").await;
    let owner_file_id = create_test_file(&pool, owner_id, "owner-activity.txt").await;
    let other_file_id = create_test_file(&pool, other_id, "other-activity.txt").await;
    let repo = AuditEventsRepo::new(&pool);

    repo.create(CreateAuditEvent {
        user_id: owner_id,
        actor_type: "user",
        actor_user_id: Some(owner_id),
        source: "web",
        event_type: "file.uploaded",
        target_type: "file",
        file_id: Some(owner_file_id),
        folder_id: None,
        share_id: None,
        file_request_id: None,
        api_token_id: None,
        status: Some(200),
        ip_address: None,
        user_agent: None,
        metadata: json!({ "filename": "owner-activity.txt", "token": "hidden" }),
    })
    .await
    .unwrap();
    repo.create(CreateAuditEvent {
        user_id: owner_id,
        actor_type: "system",
        actor_user_id: None,
        source: "worker",
        event_type: "ocr.skipped",
        target_type: "file",
        file_id: Some(owner_file_id),
        folder_id: None,
        share_id: None,
        file_request_id: None,
        api_token_id: None,
        status: None,
        ip_address: None,
        user_agent: None,
        metadata: json!({ "reason": "disabled" }),
    })
    .await
    .unwrap();
    repo.create(CreateAuditEvent {
        user_id: other_id,
        actor_type: "user",
        actor_user_id: Some(other_id),
        source: "web",
        event_type: "file.uploaded",
        target_type: "file",
        file_id: Some(other_file_id),
        folder_id: None,
        share_id: None,
        file_request_id: None,
        api_token_id: None,
        status: Some(200),
        ip_address: None,
        user_agent: None,
        metadata: json!({ "filename": "other-activity.txt" }),
    })
    .await
    .unwrap();

    let app = build_test_app(&pool).await;
    let (auth_name, auth_value) = bearer_auth_header(&token);
    let response = app
        .clone()
        .oneshot(
            axum::http::Request::get(format!(
                "/api/v1/activity?limit=1&target_type=file&file_id={owner_file_id}"
            ))
            .header(auth_name.clone(), auth_value.clone())
            .body(AxumBody::empty())
            .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    let first_page = json_body(response).await;
    assert_eq!(first_page["events"].as_array().unwrap().len(), 1);
    assert!(first_page["next_cursor"].as_str().is_some());
    assert_eq!(first_page["events"][0]["user_id"], owner_id.to_string());
    assert_ne!(
        first_page["events"][0]["file_id"],
        other_file_id.to_string()
    );

    let cursor = urlencoding::encode(first_page["next_cursor"].as_str().unwrap());
    let response = app
        .clone()
        .oneshot(
            axum::http::Request::get(format!(
                "/api/v1/activity?limit=10&target_type=file&file_id={owner_file_id}&cursor={cursor}"
            ))
            .header(auth_name.clone(), auth_value.clone())
            .body(AxumBody::empty())
            .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let second_page = json_body(response).await;
    assert_eq!(second_page["events"].as_array().unwrap().len(), 1);
    let serialized = second_page.to_string();
    assert!(!serialized.contains("hidden"));
}

#[tokio::test]
#[serial(activity_db)]
async fn file_activity_requires_file_ownership() {
    init_test_env();
    let pool = create_test_pool().await;
    cleanup_test_data(&pool).await;
    let (_owner_id, token) = login_and_get_token(&pool, "activity_file_owner").await;
    let (other_id, _, _) = create_test_user(&pool, "activity_file_other").await;
    let other_file_id = create_test_file(&pool, other_id, "private.txt").await;
    let app = build_test_app(&pool).await;
    let (auth_name, auth_value) = bearer_auth_header(&token);

    let response = app
        .oneshot(
            axum::http::Request::get(format!("/api/v1/files/{other_file_id}/activity"))
                .header(auth_name, auth_value)
                .body(AxumBody::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
#[serial(activity_db)]
async fn upload_records_file_activity_event() {
    init_test_env();
    let pool = create_test_pool().await;
    cleanup_test_data(&pool).await;
    let (_owner_id, token) = login_and_get_token(&pool, "activity_upload").await;
    let app = build_test_app(&pool).await;
    let (auth_name, auth_value) = bearer_auth_header(&token);
    let boundary = "activity-upload-boundary";

    let upload_response = app
        .clone()
        .oneshot(
            axum::http::Request::post("/api/v1/files/upload")
                .header(
                    "Content-Type",
                    format!("multipart/form-data; boundary={boundary}"),
                )
                .header(auth_name.clone(), auth_value.clone())
                .body(AxumBody::from(multipart_body(
                    boundary,
                    "activity-upload.txt",
                    "hello audit",
                )))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(upload_response.status(), StatusCode::OK);
    let upload_json = json_body(upload_response).await;
    let file_id = upload_json["file"]["id"].as_str().unwrap();

    let activity_response = app
        .oneshot(
            axum::http::Request::get(format!("/api/v1/files/{file_id}/activity"))
                .header(auth_name, auth_value)
                .body(AxumBody::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(activity_response.status(), StatusCode::OK);
    let activity_json = json_body(activity_response).await;
    assert_eq!(activity_json["events"].as_array().unwrap().len(), 1);
    assert_eq!(activity_json["events"][0]["event_type"], "file.uploaded");
    assert_eq!(activity_json["events"][0]["source"], "web");
    assert_eq!(
        activity_json["events"][0]["metadata"]["filename"],
        "activity-upload.txt"
    );
}

#[tokio::test]
#[serial(activity_db)]
async fn activity_feed_filters_all_target_identifiers_and_preserves_history() {
    init_test_env();
    let pool = create_test_pool().await;
    cleanup_test_data(&pool).await;
    let (owner_id, token) = login_and_get_token(&pool, "activity_target_filters").await;
    let file_id = create_test_file(&pool, owner_id, "target-filter.txt").await;
    let folder_id: Uuid =
        sqlx::query_scalar("INSERT INTO folders (user_id, name) VALUES ($1, $2) RETURNING id")
            .bind(owner_id)
            .bind("Audit Sources")
            .fetch_one(&pool)
            .await
            .unwrap();
    let share_id: Uuid = sqlx::query_scalar(
        "INSERT INTO file_shares (file_id, user_id, share_token) VALUES ($1, $2, $3) RETURNING id",
    )
    .bind(file_id)
    .bind(owner_id)
    .bind("audit-target-share-token")
    .fetch_one(&pool)
    .await
    .unwrap();
    let file_request_id: Uuid = sqlx::query_scalar(
        "INSERT INTO file_requests (user_id, folder_id, token_hash, token_prefix, title) VALUES ($1, $2, $3, $4, $5) RETURNING id",
    )
    .bind(owner_id)
    .bind(folder_id)
    .bind("audit-target-request-hash")
    .bind("auditreq")
    .bind("Audit upload")
    .fetch_one(&pool)
    .await
    .unwrap();
    let api_token_id: Uuid = sqlx::query_scalar(
        "INSERT INTO api_tokens (user_id, token_hash, token_prefix, name) VALUES ($1, $2, $3, $4) RETURNING id",
    )
    .bind(owner_id)
    .bind("audit-target-api-token-hash")
    .bind("audtok")
    .bind("Audit WebDAV")
    .fetch_one(&pool)
    .await
    .unwrap();
    let repo = AuditEventsRepo::new(&pool);

    for (event_type, folder, share, request, token) in [
        ("folder.filtered", Some(folder_id), None, None, None),
        ("share.filtered", None, Some(share_id), None, None),
        (
            "file_request.filtered",
            None,
            None,
            Some(file_request_id),
            None,
        ),
        ("webdav.filtered", None, None, None, Some(api_token_id)),
    ] {
        repo.create(CreateAuditEvent {
            user_id: owner_id,
            actor_type: "user",
            actor_user_id: Some(owner_id),
            source: "web",
            event_type,
            target_type: "audit_target",
            file_id: Some(file_id),
            folder_id: folder,
            share_id: share,
            file_request_id: request,
            api_token_id: token,
            status: Some(200),
            ip_address: None,
            user_agent: None,
            metadata: json!({ "filename": "target-filter.txt" }),
        })
        .await
        .unwrap();
    }

    let app = build_test_app(&pool).await;
    for (query, expected_event_type, expected_field, expected_value) in [
        (
            format!("folder_id={folder_id}"),
            "folder.filtered",
            "folder_id",
            folder_id.to_string(),
        ),
        (
            format!("share_id={share_id}"),
            "share.filtered",
            "share_id",
            share_id.to_string(),
        ),
        (
            format!("file_request_id={file_request_id}"),
            "file_request.filtered",
            "file_request_id",
            file_request_id.to_string(),
        ),
        (
            format!("api_token_id={api_token_id}"),
            "webdav.filtered",
            "api_token_id",
            api_token_id.to_string(),
        ),
    ] {
        let activity = activity_events(&app, &token, &format!("{query}&limit=10")).await;
        let events = activity["events"].as_array().unwrap();
        assert_eq!(events.len(), 1, "query {query} should be selective");
        assert_eq!(events[0]["event_type"], expected_event_type);
        assert_eq!(events[0][expected_field], expected_value);
    }

    sqlx::query("DELETE FROM file_shares WHERE id = $1")
        .bind(share_id)
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("DELETE FROM file_requests WHERE id = $1")
        .bind(file_request_id)
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("DELETE FROM api_tokens WHERE id = $1")
        .bind(api_token_id)
        .execute(&pool)
        .await
        .unwrap();

    let share_history = activity_events(&app, &token, &format!("share_id={share_id}")).await;
    assert_eq!(share_history["events"][0]["share_id"], share_id.to_string());
    let request_history =
        activity_events(&app, &token, &format!("file_request_id={file_request_id}")).await;
    assert_eq!(
        request_history["events"][0]["file_request_id"],
        file_request_id.to_string()
    );
    let token_history =
        activity_events(&app, &token, &format!("api_token_id={api_token_id}")).await;
    assert_eq!(
        token_history["events"][0]["api_token_id"],
        api_token_id.to_string()
    );
}

#[tokio::test]
#[serial(activity_db)]
async fn file_tags_and_flags_record_activity_events() {
    init_test_env();
    let pool = create_test_pool().await;
    cleanup_test_data(&pool).await;
    let (owner_id, token) = login_and_get_token(&pool, "activity_metadata").await;
    let file_id = create_test_file(&pool, owner_id, "metadata-audit.txt").await;
    let tag_id: uuid::Uuid = sqlx::query_scalar(
        "INSERT INTO file_tags (user_id, name, color) VALUES ($1, $2, $3) RETURNING id",
    )
    .bind(owner_id)
    .bind("Legal")
    .bind("#00ff99")
    .fetch_one(&pool)
    .await
    .unwrap();

    let app = build_test_app(&pool).await;
    let (auth_name, auth_value) = bearer_auth_header(&token);
    let flags_response = app
        .clone()
        .oneshot(
            axum::http::Request::patch(format!("/api/v1/files/{file_id}/flags"))
                .header(auth_name.clone(), auth_value.clone())
                .header("Content-Type", "application/json")
                .body(AxumBody::from(
                    json!({ "is_favorite": true, "is_pinned": true }).to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(flags_response.status(), StatusCode::OK);

    let tags_response = app
        .clone()
        .oneshot(
            axum::http::Request::put(format!("/api/v1/files/{file_id}/tags"))
                .header(auth_name, auth_value)
                .header("Content-Type", "application/json")
                .body(AxumBody::from(json!({ "tag_ids": [tag_id] }).to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(tags_response.status(), StatusCode::OK);

    let activity = activity_events(&app, &token, &format!("file_id={file_id}&limit=10")).await;
    let event_types: Vec<_> = activity["events"]
        .as_array()
        .unwrap()
        .iter()
        .map(|event| event["event_type"].as_str().unwrap())
        .collect();
    assert!(event_types.contains(&"file.flags_updated"));
    assert!(event_types.contains(&"file.tags_updated"));
}

#[tokio::test]
#[serial(activity_db)]
async fn trash_and_version_restore_record_activity_events() {
    init_test_env();
    let pool = create_test_pool().await;
    cleanup_test_data(&pool).await;
    let (_owner_id, token) = login_and_get_token(&pool, "activity_trash_version").await;
    let app = build_test_app(&pool).await;
    let (auth_name, auth_value) = bearer_auth_header(&token);
    let boundary = "activity-version-boundary";

    let first_upload = app
        .clone()
        .oneshot(
            axum::http::Request::post("/api/v1/files/upload")
                .header(
                    "Content-Type",
                    format!("multipart/form-data; boundary={boundary}"),
                )
                .header(auth_name.clone(), auth_value.clone())
                .body(AxumBody::from(multipart_body(
                    boundary,
                    "versioned-audit.txt",
                    "version one",
                )))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(first_upload.status(), StatusCode::OK);
    let file_id = json_body(first_upload).await["file"]["id"]
        .as_str()
        .unwrap()
        .to_string();

    let second_upload = app
        .clone()
        .oneshot(
            axum::http::Request::post("/api/v1/files/upload")
                .header(
                    "Content-Type",
                    format!("multipart/form-data; boundary={boundary}"),
                )
                .header(auth_name.clone(), auth_value.clone())
                .body(AxumBody::from(multipart_body(
                    boundary,
                    "versioned-audit.txt",
                    "version two",
                )))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(second_upload.status(), StatusCode::OK);

    let versions_response = app
        .clone()
        .oneshot(
            axum::http::Request::get(format!("/api/v1/files/{file_id}/versions"))
                .header(auth_name.clone(), auth_value.clone())
                .body(AxumBody::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(versions_response.status(), StatusCode::OK);
    let versions = json_body(versions_response).await;
    let version_id = versions["versions"][0]["id"].as_str().unwrap();

    let restore_version_response = app
        .clone()
        .oneshot(
            axum::http::Request::post(format!(
                "/api/v1/files/{file_id}/versions/{version_id}/restore"
            ))
            .header(auth_name.clone(), auth_value.clone())
            .header("Content-Type", "application/json")
            .body(AxumBody::from(json!({ "keep_current": true }).to_string()))
            .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(restore_version_response.status(), StatusCode::OK);

    let delete_response = app
        .clone()
        .oneshot(
            axum::http::Request::delete(format!("/api/v1/files/{file_id}"))
                .header(auth_name.clone(), auth_value.clone())
                .body(AxumBody::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(delete_response.status(), StatusCode::OK);

    let restore_response = app
        .clone()
        .oneshot(
            axum::http::Request::post(format!("/api/v1/files/{file_id}/restore"))
                .header(auth_name.clone(), auth_value.clone())
                .body(AxumBody::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(restore_response.status(), StatusCode::OK);

    let delete_again_response = app
        .clone()
        .oneshot(
            axum::http::Request::delete(format!("/api/v1/files/{file_id}"))
                .header(auth_name.clone(), auth_value.clone())
                .body(AxumBody::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(delete_again_response.status(), StatusCode::OK);

    let permanent_response = app
        .clone()
        .oneshot(
            axum::http::Request::delete(format!("/api/v1/files/{file_id}/permanent"))
                .header(auth_name.clone(), auth_value.clone())
                .body(AxumBody::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(permanent_response.status(), StatusCode::OK);

    let activity = activity_events(&app, &token, &format!("file_id={file_id}&limit=20")).await;
    let event_types: Vec<_> = activity["events"]
        .as_array()
        .unwrap()
        .iter()
        .map(|event| event["event_type"].as_str().unwrap())
        .collect();
    assert!(event_types.contains(&"file.version_restored"));
    assert!(event_types.contains(&"file.restored"));
    assert!(event_types.contains(&"file.permanently_deleted"));
}
