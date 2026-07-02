mod common;

use axum::{
    body::{to_bytes, Body as AxumBody},
    extract::ConnectInfo,
    http::StatusCode,
};
use chrono::{Duration, Utc};
use common::{
    app::{bearer_auth_header, build_test_app, login_and_get_token},
    cleanup_test_data, create_test_file, create_test_folder, create_test_pool, init_test_env,
};
use serial_test::serial;
use std::net::{Ipv4Addr, SocketAddr};
use tower::ServiceExt;

async fn json_body(response: axum::response::Response) -> serde_json::Value {
    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    serde_json::from_slice(&body).unwrap()
}

fn multipart_body(
    boundary: &str,
    fields: &[(&str, &str)],
    filename: &str,
    content: &str,
) -> String {
    let mut body = String::new();
    for (name, value) in fields {
        body.push_str(&format!(
            "--{boundary}\r\nContent-Disposition: form-data; name=\"{name}\"\r\n\r\n{value}\r\n"
        ));
    }
    body.push_str(&format!(
        "--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{filename}\"\r\nContent-Type: text/plain\r\n\r\n{content}\r\n--{boundary}--\r\n"
    ));
    body
}

fn multipart_body_bytes(
    boundary: &str,
    fields: &[(&str, &str)],
    filename: &str,
    content_type: &str,
    content: &[u8],
) -> Vec<u8> {
    let mut body = Vec::new();
    for (name, value) in fields {
        body.extend_from_slice(
            format!(
                "--{boundary}\r\nContent-Disposition: form-data; name=\"{name}\"\r\n\r\n{value}\r\n"
            )
            .as_bytes(),
        );
    }
    body.extend_from_slice(
        format!(
            "--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{filename}\"\r\nContent-Type: {content_type}\r\n\r\n"
        )
        .as_bytes(),
    );
    body.extend_from_slice(content);
    body.extend_from_slice(format!("\r\n--{boundary}--\r\n").as_bytes());
    body
}

#[tokio::test]
#[serial(productivity_features_db)]
async fn all_collection_lists_pinned_files_before_regular_files() {
    init_test_env();
    let pool = create_test_pool().await;
    cleanup_test_data(&pool).await;
    let (user_id, token) = login_and_get_token(&pool, "pinned_all_order").await;
    let app = build_test_app(&pool).await;
    let (auth_name, auth_value) = bearer_auth_header(&token);

    let newer_regular_id = create_test_file(&pool, user_id, "newer-regular.png").await;
    let older_pinned_id = create_test_file(&pool, user_id, "older-pinned.png").await;

    sqlx::query(
        "UPDATE files
         SET mime_type = 'image/png',
             created_at = CASE
                 WHEN id = $1 THEN CURRENT_TIMESTAMP
                 WHEN id = $2 THEN CURRENT_TIMESTAMP - INTERVAL '1 day'
             END,
             is_pinned = CASE WHEN id = $2 THEN TRUE ELSE FALSE END
         WHERE id = ANY($3)",
    )
    .bind(newer_regular_id)
    .bind(older_pinned_id)
    .bind(vec![newer_regular_id, older_pinned_id])
    .execute(&pool)
    .await
    .unwrap();

    let response = app
        .clone()
        .oneshot(
            axum::http::Request::get("/api/v1/files?limit=1&sort_by=created_at&sort_order=desc")
                .header(auth_name.clone(), auth_value.clone())
                .body(AxumBody::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    let json = json_body(response).await;
    assert_eq!(json["files"].as_array().unwrap().len(), 1);
    assert_eq!(json["files"][0]["id"], older_pinned_id.to_string());
    assert_eq!(json["files"][0]["is_pinned"], true);
}

#[tokio::test]
#[serial(productivity_features_db)]
async fn file_versions_include_current_metadata_diff_and_keep_twenty_history_entries() {
    init_test_env();
    let pool = create_test_pool().await;
    cleanup_test_data(&pool).await;
    let (_user_id, token) = login_and_get_token(&pool, "versions_productized").await;
    let app = build_test_app(&pool).await;
    let (auth_name, auth_value) = bearer_auth_header(&token);

    let mut file_id = String::new();
    for idx in 0..22 {
        let boundary = format!("version-boundary-{idx}");
        let body = multipart_body(&boundary, &[], "notes.md", &format!("version {idx}\n"));
        let response = app
            .clone()
            .oneshot(
                axum::http::Request::post("/api/v1/files/upload")
                    .header(
                        "Content-Type",
                        format!("multipart/form-data; boundary={boundary}"),
                    )
                    .header(auth_name.clone(), auth_value.clone())
                    .body(AxumBody::from(body))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::OK);
        let upload_json = json_body(response).await;
        file_id = upload_json["file"]["id"].as_str().unwrap().to_string();
    }

    let versions_response = app
        .clone()
        .oneshot(
            axum::http::Request::get(format!("/api/v1/files/{}/versions", file_id))
                .header(auth_name.clone(), auth_value.clone())
                .body(AxumBody::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(versions_response.status(), StatusCode::OK);
    let versions_json = json_body(versions_response).await;
    assert_eq!(versions_json["current"]["id"], file_id);
    assert_eq!(versions_json["versions"].as_array().unwrap().len(), 20);
    assert_eq!(versions_json["versions"][0]["can_diff"], true);
    assert_eq!(versions_json["versions"][0]["can_preview"], true);
    let version_id = versions_json["versions"][0]["id"].as_str().unwrap();

    let diff_response = app
        .clone()
        .oneshot(
            axum::http::Request::get(format!(
                "/api/v1/files/{}/versions/{version_id}/diff?against=current",
                file_id
            ))
            .header(auth_name, auth_value)
            .body(AxumBody::empty())
            .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(diff_response.status(), StatusCode::OK);
    let diff_json = json_body(diff_response).await;
    assert!(diff_json["diff"].as_str().unwrap().contains("-version"));
    assert!(diff_json["diff"].as_str().unwrap().contains("+version"));
}

#[tokio::test]
#[serial(productivity_features_db)]
async fn share_center_lists_events_without_incrementing_downloads_on_access() {
    init_test_env();
    let pool = create_test_pool().await;
    cleanup_test_data(&pool).await;
    let (user_id, token) = login_and_get_token(&pool, "share_center").await;
    let file_id = create_test_file(&pool, user_id, "shared.txt").await;
    let app = build_test_app(&pool).await;
    let (auth_name, auth_value) = bearer_auth_header(&token);

    let create_response = app
        .clone()
        .oneshot(
            axum::http::Request::post("/api/v1/shares")
                .header(auth_name.clone(), auth_value.clone())
                .header("Content-Type", "application/json")
                .body(AxumBody::from(
                    serde_json::json!({ "file_id": file_id }).to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(create_response.status(), StatusCode::OK);
    let share_json = json_body(create_response).await;
    let share_id = share_json["share"]["id"].as_str().unwrap();
    let share_token = share_json["share"]["token"].as_str().unwrap();

    let access_response = app
        .clone()
        .oneshot(
            axum::http::Request::post(format!("/api/v1/shares/{share_token}/access"))
                .header("Content-Type", "application/json")
                .body(AxumBody::from("{}"))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(access_response.status(), StatusCode::OK);

    let list_response = app
        .clone()
        .oneshot(
            axum::http::Request::get("/api/v1/shares")
                .header(auth_name.clone(), auth_value.clone())
                .body(AxumBody::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(list_response.status(), StatusCode::OK);
    let list_json = json_body(list_response).await;
    assert_eq!(list_json["shares"][0]["id"], share_id);
    assert_eq!(list_json["shares"][0]["filename"], "shared.txt");
    assert_eq!(list_json["shares"][0]["access_count"], 1);
    assert_eq!(list_json["shares"][0]["download_count"], 0);
    assert_eq!(list_json["shares"][0]["has_password"], false);

    let download_response = app
        .clone()
        .oneshot(
            axum::http::Request::get(format!("/api/v1/shares/{share_token}/download"))
                .body(AxumBody::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(download_response.status(), StatusCode::OK);

    let events_response = app
        .oneshot(
            axum::http::Request::get(format!("/api/v1/shares/{share_id}/events"))
                .header(auth_name, auth_value)
                .body(AxumBody::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(events_response.status(), StatusCode::OK);
    let events_json = json_body(events_response).await;
    assert_eq!(events_json["events"].as_array().unwrap().len(), 2);
}

#[tokio::test]
#[serial(productivity_features_db)]
async fn file_request_public_upload_writes_only_to_owner_folder() {
    init_test_env();
    let pool = create_test_pool().await;
    cleanup_test_data(&pool).await;
    let (_user_id, token) = login_and_get_token(&pool, "file_request_owner").await;
    let app = build_test_app(&pool).await;
    let (auth_name, auth_value) = bearer_auth_header(&token);

    let create_response = app
        .clone()
        .oneshot(
            axum::http::Request::post("/api/v1/file-requests")
                .header(auth_name.clone(), auth_value.clone())
                .header("Content-Type", "application/json")
                .body(AxumBody::from(
                    serde_json::json!({
                        "title": "Collect notes",
                        "description": "Upload text files only",
                        "allowed_mime_prefixes": ["text/"],
                        "max_file_size": 2048,
                        "max_uploads": 1,
                        "expires_in_days": 7
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(create_response.status(), StatusCode::OK);
    let create_json = json_body(create_response).await;
    let public_url = create_json["request"]["public_url"].as_str().unwrap();
    let token = public_url.rsplit('/').next().unwrap();
    assert!(create_json["request"]["token"].is_null());

    let public_response = app
        .clone()
        .oneshot(
            axum::http::Request::get(format!("/api/v1/file-requests/public/{token}"))
                .body(AxumBody::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(public_response.status(), StatusCode::OK);
    let public_json = json_body(public_response).await;
    assert_eq!(public_json["request"]["title"], "Collect notes");

    let boundary = "file-request-boundary";
    let upload_body = multipart_body(boundary, &[], "guest.txt", "hello from guest");
    let upload_response = app
        .clone()
        .oneshot(
            axum::http::Request::post(format!("/api/v1/file-requests/public/{token}/upload"))
                .header(
                    "Content-Type",
                    format!("multipart/form-data; boundary={boundary}"),
                )
                .body(AxumBody::from(upload_body))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(upload_response.status(), StatusCode::OK);
    let upload_json = json_body(upload_response).await;
    assert!(upload_json.get("file_id").is_none());
    assert_eq!(upload_json["submission"]["file_count"], 1);
    assert!(upload_json.get("files").is_none());

    let second_upload_body = multipart_body(boundary, &[], "guest-2.txt", "too many");
    let second_response = app
        .clone()
        .oneshot(
            axum::http::Request::post(format!("/api/v1/file-requests/public/{token}/upload"))
                .header(
                    "Content-Type",
                    format!("multipart/form-data; boundary={boundary}"),
                )
                .body(AxumBody::from(second_upload_body))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(second_response.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
#[serial(productivity_features_db)]
async fn file_request_upload_enters_hidden_review_inbox_before_approval() {
    init_test_env();
    let pool = create_test_pool().await;
    cleanup_test_data(&pool).await;
    let (user_id, token) = login_and_get_token(&pool, "file_request_inbox_owner").await;
    let app = build_test_app(&pool).await;
    let (auth_name, auth_value) = bearer_auth_header(&token);

    let create_response = app
        .clone()
        .oneshot(
            axum::http::Request::post("/api/v1/file-requests")
                .header(auth_name.clone(), auth_value.clone())
                .header("Content-Type", "application/json")
                .body(AxumBody::from(
                    serde_json::json!({
                        "title": "Review intake",
                        "allowed_mime_prefixes": ["text/"],
                        "max_file_size": 2048,
                        "max_uploads": 4,
                        "expires_in_days": 7
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(create_response.status(), StatusCode::OK);
    let create_json = json_body(create_response).await;
    let public_url = create_json["request"]["public_url"].as_str().unwrap();
    let public_token = public_url.rsplit('/').next().unwrap();
    let request_id = uuid::Uuid::parse_str(create_json["request"]["id"].as_str().unwrap()).unwrap();
    let existing_file_id = create_test_file(&pool, user_id, "contract.txt").await;

    let boundary = "file-request-inbox-boundary";
    let upload_body = multipart_body(
        boundary,
        &[
            ("submitter_email", "client@example.com"),
            ("submitter_note", "Signed contract attached"),
        ],
        "contract.txt",
        "pending contract",
    );
    let mut upload_request = axum::http::Request::post(format!(
        "/api/v1/file-requests/public/{public_token}/upload"
    ))
    .header(
        "Content-Type",
        format!("multipart/form-data; boundary={boundary}"),
    )
    .header("User-Agent", "NexusSubmitter/1.0")
    .body(AxumBody::from(upload_body))
    .unwrap();
    upload_request
        .extensions_mut()
        .insert(ConnectInfo(SocketAddr::from((
            Ipv4Addr::new(203, 0, 113, 42),
            4242,
        ))));
    let upload_response = app.clone().oneshot(upload_request).await.unwrap();
    assert_eq!(upload_response.status(), StatusCode::OK);
    let upload_json = json_body(upload_response).await;
    assert!(upload_json.get("file_id").is_none());
    assert_eq!(
        upload_json["submission"]["submitter_email"],
        "client@example.com"
    );
    assert_eq!(upload_json["submission"]["file_count"], 1);

    let submission_source: (Option<String>, Option<String>) = sqlx::query_as(
        "SELECT ip_address, user_agent
         FROM file_request_submissions
         WHERE request_id = $1",
    )
    .bind(request_id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(submission_source.0.as_deref(), Some("203.0.113.42"));
    assert_eq!(submission_source.1.as_deref(), Some("NexusSubmitter/1.0"));

    let (upload_id, file_id): (uuid::Uuid, uuid::Uuid) = sqlx::query_as(
        "SELECT fru.id, fru.file_id
         FROM file_request_uploads fru
         JOIN file_request_submissions frs ON frs.id = fru.submission_id
         WHERE frs.request_id = $1",
    )
    .bind(request_id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_ne!(
        file_id, existing_file_id,
        "public File Request uploads must not version-overwrite approved files before review"
    );

    let list_response = app
        .clone()
        .oneshot(
            axum::http::Request::get("/api/v1/files")
                .header(auth_name.clone(), auth_value.clone())
                .body(AxumBody::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(list_response.status(), StatusCode::OK);
    let list_json = json_body(list_response).await;
    assert!(list_json["files"]
        .as_array()
        .unwrap()
        .iter()
        .all(|file| file["id"] != file_id.to_string()));

    let blocked_preview = app
        .clone()
        .oneshot(
            axum::http::Request::get(format!("/api/v1/files/{file_id}/preview"))
                .header(auth_name.clone(), auth_value.clone())
                .body(AxumBody::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(blocked_preview.status(), StatusCode::NOT_FOUND);

    let inbox_response = app
        .clone()
        .oneshot(
            axum::http::Request::get("/api/v1/file-requests/inbox?status=pending")
                .header(auth_name.clone(), auth_value.clone())
                .body(AxumBody::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(inbox_response.status(), StatusCode::OK);
    let inbox_json = json_body(inbox_response).await;
    assert_eq!(inbox_json["submissions"].as_array().unwrap().len(), 1);
    assert_eq!(
        inbox_json["submissions"][0]["uploads"][0]["id"],
        upload_id.to_string()
    );
    assert_eq!(
        inbox_json["submissions"][0]["uploads"][0]["status"],
        "pending"
    );
    assert_eq!(
        inbox_json["submissions"][0]["uploads"][0]["scan_status"],
        "not_scanned"
    );

    let second_boundary = "file-request-inbox-boundary-second";
    let second_body = multipart_body(
        second_boundary,
        &[("submitter_email", "second@example.com")],
        "second.txt",
        "second contract",
    );
    let second_upload_response = app
        .clone()
        .oneshot(
            axum::http::Request::post(format!(
                "/api/v1/file-requests/public/{public_token}/upload"
            ))
            .header(
                "Content-Type",
                format!("multipart/form-data; boundary={second_boundary}"),
            )
            .body(AxumBody::from(second_body))
            .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(second_upload_response.status(), StatusCode::OK);

    let first_page_response = app
        .clone()
        .oneshot(
            axum::http::Request::get("/api/v1/file-requests/inbox?limit=1")
                .header(auth_name.clone(), auth_value.clone())
                .body(AxumBody::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(first_page_response.status(), StatusCode::OK);
    let first_page_json = json_body(first_page_response).await;
    assert_eq!(first_page_json["submissions"].as_array().unwrap().len(), 1);
    let next_cursor = first_page_json["next_cursor"].as_str().unwrap();

    let second_page_response = app
        .clone()
        .oneshot(
            axum::http::Request::get(format!(
                "/api/v1/file-requests/inbox?limit=1&cursor={next_cursor}"
            ))
            .header(auth_name.clone(), auth_value.clone())
            .body(AxumBody::empty())
            .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(second_page_response.status(), StatusCode::OK);
    let second_page_json = json_body(second_page_response).await;
    assert_eq!(second_page_json["submissions"].as_array().unwrap().len(), 1);
    assert_ne!(
        first_page_json["submissions"][0]["id"],
        second_page_json["submissions"][0]["id"]
    );

    let inbox_preview = app
        .clone()
        .oneshot(
            axum::http::Request::get(format!("/api/v1/file-requests/uploads/{upload_id}/preview"))
                .header(auth_name.clone(), auth_value.clone())
                .body(AxumBody::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(inbox_preview.status(), StatusCode::OK);

    let inbox_preview_via_query_token = app
        .clone()
        .oneshot(
            axum::http::Request::get(format!(
                "/api/v1/file-requests/uploads/{upload_id}/preview?token={token}"
            ))
            .body(AxumBody::empty())
            .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(inbox_preview_via_query_token.status(), StatusCode::OK);

    let approve_response = app
        .clone()
        .oneshot(
            axum::http::Request::patch(format!("/api/v1/file-requests/uploads/{upload_id}/review"))
                .header(auth_name.clone(), auth_value.clone())
                .header("Content-Type", "application/json")
                .body(AxumBody::from(
                    serde_json::json!({
                        "action": "approve",
                        "filename": "approved-contract.txt",
                        "folder_id": null,
                        "review_note": "Looks good"
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(approve_response.status(), StatusCode::OK);
    let approve_json = json_body(approve_response).await;
    assert_eq!(approve_json["upload"]["status"], "approved");
    assert_eq!(approve_json["upload"]["filename"], "approved-contract.txt");

    let repeat_review_response = app
        .clone()
        .oneshot(
            axum::http::Request::patch(format!("/api/v1/file-requests/uploads/{upload_id}/review"))
                .header(auth_name.clone(), auth_value.clone())
                .header("Content-Type", "application/json")
                .body(AxumBody::from(
                    serde_json::json!({
                        "action": "reject",
                        "review_note": "too late"
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(repeat_review_response.status(), StatusCode::CONFLICT);

    let visible_response = app
        .clone()
        .oneshot(
            axum::http::Request::get("/api/v1/files")
                .header(auth_name.clone(), auth_value.clone())
                .body(AxumBody::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(visible_response.status(), StatusCode::OK);
    let visible_json = json_body(visible_response).await;
    assert!(visible_json["files"]
        .as_array()
        .unwrap()
        .iter()
        .any(|file| file["id"] == file_id.to_string()
            && file["original_filename"] == "approved-contract.txt"));

    let audit_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*)::BIGINT FROM audit_events
         WHERE user_id = $1
           AND file_request_id = $2
           AND event_type = ANY($3)",
    )
    .bind(user_id)
    .bind(request_id)
    .bind(vec![
        "file_request.submitted",
        "file_request.upload.approved",
    ])
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(audit_count, 3);
}

#[tokio::test]
#[serial(productivity_features_db)]
async fn file_request_inbox_exposes_publish_locations_and_allows_folder_override() {
    init_test_env();
    let pool = create_test_pool().await;
    cleanup_test_data(&pool).await;
    let (user_id, token) = login_and_get_token(&pool, "file_request_location_owner").await;
    let (other_user_id, _) = login_and_get_token(&pool, "file_request_location_other").await;
    let default_folder_id = create_test_folder(&pool, user_id, "Default Inbox", None).await;
    let alternate_folder_id = create_test_folder(&pool, user_id, "Reviewed Assets", None).await;
    let foreign_folder_id = create_test_folder(&pool, other_user_id, "Foreign", None).await;
    let app = build_test_app(&pool).await;
    let (auth_name, auth_value) = bearer_auth_header(&token);

    let create_response = app
        .clone()
        .oneshot(
            axum::http::Request::post("/api/v1/file-requests")
                .header(auth_name.clone(), auth_value.clone())
                .header("Content-Type", "application/json")
                .body(AxumBody::from(
                    serde_json::json!({
                        "title": "Location intake",
                        "folder_id": default_folder_id,
                        "allowed_mime_prefixes": ["text/"],
                        "max_file_size": 2048,
                        "max_uploads": 4,
                        "expires_in_days": 7
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(create_response.status(), StatusCode::OK);
    let create_json = json_body(create_response).await;
    assert_eq!(
        create_json["request"]["folder_id"],
        default_folder_id.to_string()
    );
    assert_eq!(create_json["request"]["folder_name"], "Default Inbox");
    let public_token = create_json["request"]["public_url"]
        .as_str()
        .unwrap()
        .rsplit('/')
        .next()
        .unwrap()
        .to_string();
    let request_id = uuid::Uuid::parse_str(create_json["request"]["id"].as_str().unwrap()).unwrap();

    for (boundary, filename, content) in [
        (
            "file-request-location-a",
            "default-target.txt",
            "default body",
        ),
        (
            "file-request-location-b",
            "alternate-target.txt",
            "alternate body",
        ),
        ("file-request-location-c", "root-target.txt", "root body"),
    ] {
        let body = multipart_body(boundary, &[], filename, content);
        let response = app
            .clone()
            .oneshot(
                axum::http::Request::post(format!(
                    "/api/v1/file-requests/public/{public_token}/upload"
                ))
                .header(
                    "Content-Type",
                    format!("multipart/form-data; boundary={boundary}"),
                )
                .body(AxumBody::from(body))
                .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::OK);
    }

    let inbox_response = app
        .clone()
        .oneshot(
            axum::http::Request::get(format!(
                "/api/v1/file-requests/inbox?request_id={request_id}&limit=10"
            ))
            .header(auth_name.clone(), auth_value.clone())
            .body(AxumBody::empty())
            .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(inbox_response.status(), StatusCode::OK);
    let inbox_json = json_body(inbox_response).await;
    assert_eq!(
        inbox_json["submissions"][0]["request_title"],
        "Location intake"
    );
    assert_eq!(
        inbox_json["submissions"][0]["request_folder_id"],
        default_folder_id.to_string()
    );
    assert_eq!(
        inbox_json["submissions"][0]["request_folder_name"],
        "Default Inbox"
    );
    assert!(inbox_json["submissions"]
        .as_array()
        .unwrap()
        .iter()
        .flat_map(|submission| submission["uploads"].as_array().unwrap().iter())
        .all(
            |upload| upload["folder_id"] == default_folder_id.to_string()
                && upload["folder_name"] == "Default Inbox"
        ));

    let upload_rows: Vec<(uuid::Uuid, String)> = sqlx::query_as(
        "SELECT id, filename FROM file_request_uploads WHERE request_id = $1 ORDER BY filename",
    )
    .bind(request_id)
    .fetch_all(&pool)
    .await
    .unwrap();
    let default_upload_id = upload_rows
        .iter()
        .find(|(_, filename)| filename == "default-target.txt")
        .unwrap()
        .0;
    let alternate_upload_id = upload_rows
        .iter()
        .find(|(_, filename)| filename == "alternate-target.txt")
        .unwrap()
        .0;
    let root_upload_id = upload_rows
        .iter()
        .find(|(_, filename)| filename == "root-target.txt")
        .unwrap()
        .0;

    let approve_default_response = app
        .clone()
        .oneshot(
            axum::http::Request::patch(format!(
                "/api/v1/file-requests/uploads/{default_upload_id}/review"
            ))
            .header(auth_name.clone(), auth_value.clone())
            .header("Content-Type", "application/json")
            .body(AxumBody::from(
                serde_json::json!({
                    "action": "approve",
                    "filename": "default-approved.txt"
                })
                .to_string(),
            ))
            .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(approve_default_response.status(), StatusCode::OK);
    let approve_default_json = json_body(approve_default_response).await;
    assert_eq!(
        approve_default_json["upload"]["folder_id"],
        default_folder_id.to_string()
    );
    assert_eq!(
        approve_default_json["upload"]["folder_name"],
        "Default Inbox"
    );

    let foreign_folder_response = app
        .clone()
        .oneshot(
            axum::http::Request::patch(format!(
                "/api/v1/file-requests/uploads/{alternate_upload_id}/review"
            ))
            .header(auth_name.clone(), auth_value.clone())
            .header("Content-Type", "application/json")
            .body(AxumBody::from(
                serde_json::json!({
                    "action": "approve",
                    "folder_id": foreign_folder_id
                })
                .to_string(),
            ))
            .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(foreign_folder_response.status(), StatusCode::BAD_REQUEST);

    let approve_alternate_response = app
        .clone()
        .oneshot(
            axum::http::Request::patch(format!(
                "/api/v1/file-requests/uploads/{alternate_upload_id}/review"
            ))
            .header(auth_name.clone(), auth_value.clone())
            .header("Content-Type", "application/json")
            .body(AxumBody::from(
                serde_json::json!({
                    "action": "approve",
                    "filename": "alternate-approved.txt",
                    "folder_id": alternate_folder_id
                })
                .to_string(),
            ))
            .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(approve_alternate_response.status(), StatusCode::OK);
    let approve_alternate_json = json_body(approve_alternate_response).await;
    assert_eq!(
        approve_alternate_json["upload"]["folder_id"],
        alternate_folder_id.to_string()
    );
    assert_eq!(
        approve_alternate_json["upload"]["folder_name"],
        "Reviewed Assets"
    );

    let approve_root_response = app
        .clone()
        .oneshot(
            axum::http::Request::patch(format!(
                "/api/v1/file-requests/uploads/{root_upload_id}/review"
            ))
            .header(auth_name.clone(), auth_value.clone())
            .header("Content-Type", "application/json")
            .body(AxumBody::from(
                serde_json::json!({
                    "action": "approve",
                    "filename": "root-approved.txt",
                    "folder_id": null
                })
                .to_string(),
            ))
            .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(approve_root_response.status(), StatusCode::OK);
    let approve_root_json = json_body(approve_root_response).await;
    assert!(approve_root_json["upload"]["folder_id"].is_null());
    assert!(approve_root_json["upload"]["folder_name"].is_null());

    let default_folder_response = app
        .clone()
        .oneshot(
            axum::http::Request::get(format!("/api/v1/files?folder_id={default_folder_id}"))
                .header(auth_name.clone(), auth_value.clone())
                .body(AxumBody::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(default_folder_response.status(), StatusCode::OK);
    let default_folder_json = json_body(default_folder_response).await;
    assert!(default_folder_json["files"]
        .as_array()
        .unwrap()
        .iter()
        .any(|file| file["original_filename"] == "default-approved.txt"));
    assert!(default_folder_json["files"]
        .as_array()
        .unwrap()
        .iter()
        .all(|file| file["original_filename"] != "alternate-approved.txt"));

    let alternate_folder_response = app
        .clone()
        .oneshot(
            axum::http::Request::get(format!("/api/v1/files?folder_id={alternate_folder_id}"))
                .header(auth_name.clone(), auth_value.clone())
                .body(AxumBody::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(alternate_folder_response.status(), StatusCode::OK);
    let alternate_folder_json = json_body(alternate_folder_response).await;
    assert!(alternate_folder_json["files"]
        .as_array()
        .unwrap()
        .iter()
        .any(|file| file["original_filename"] == "alternate-approved.txt"));

    let root_folder_response = app
        .clone()
        .oneshot(
            axum::http::Request::get("/api/v1/files?folder_id=root")
                .header(auth_name.clone(), auth_value.clone())
                .body(AxumBody::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(root_folder_response.status(), StatusCode::OK);
    let root_folder_json = json_body(root_folder_response).await;
    assert!(root_folder_json["files"]
        .as_array()
        .unwrap()
        .iter()
        .any(|file| file["original_filename"] == "root-approved.txt"));
}

#[tokio::test]
#[serial(productivity_features_db)]
async fn file_request_public_upload_accepts_files_larger_than_default_multipart_limit() {
    init_test_env();
    let pool = create_test_pool().await;
    cleanup_test_data(&pool).await;
    let (_user_id, token) = login_and_get_token(&pool, "file_request_big_upload_owner").await;
    let app = build_test_app(&pool).await;
    let (auth_name, auth_value) = bearer_auth_header(&token);

    let create_response = app
        .clone()
        .oneshot(
            axum::http::Request::post("/api/v1/file-requests")
                .header(auth_name.clone(), auth_value.clone())
                .header("Content-Type", "application/json")
                .body(AxumBody::from(
                    serde_json::json!({
                        "title": "Large review intake",
                        "allowed_mime_prefixes": ["image/"],
                        "max_file_size": 10 * 1024 * 1024,
                        "expires_in_days": 7
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(create_response.status(), StatusCode::OK);
    let create_json = json_body(create_response).await;
    let public_url = create_json["request"]["public_url"].as_str().unwrap();
    let public_token = public_url.rsplit('/').next().unwrap();

    let boundary = "file-request-large-upload-boundary";
    let large_content = vec![b'a'; 2_500_000];
    let upload_body = multipart_body_bytes(
        boundary,
        &[],
        "camera-roll.jpg",
        "image/jpeg",
        &large_content,
    );
    let upload_response = app
        .clone()
        .oneshot(
            axum::http::Request::post(format!(
                "/api/v1/file-requests/public/{public_token}/upload"
            ))
            .header(
                "Content-Type",
                format!("multipart/form-data; boundary={boundary}"),
            )
            .body(AxumBody::from(upload_body))
            .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(upload_response.status(), StatusCode::OK);
    let upload_json = json_body(upload_response).await;
    assert_eq!(upload_json["submission"]["file_count"], 1);
}

#[tokio::test]
#[serial(productivity_features_db)]
async fn tags_flags_and_smart_collections_are_user_scoped() {
    init_test_env();
    let pool = create_test_pool().await;
    cleanup_test_data(&pool).await;
    let (user_id, token) = login_and_get_token(&pool, "tags_owner").await;
    let (other_user_id, _other_email, _other_password) =
        common::create_test_user(&pool, "tags_other").await;
    let file_id = create_test_file(&pool, user_id, "plan.pdf").await;
    let other_file_id = create_test_file(&pool, other_user_id, "plan.pdf").await;
    sqlx::query("UPDATE files SET content_sha256 = $1 WHERE id = ANY($2)")
        .bind("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
        .bind([file_id, other_file_id])
        .execute(&pool)
        .await
        .unwrap();

    let app = build_test_app(&pool).await;
    let (auth_name, auth_value) = bearer_auth_header(&token);

    let tag_response = app
        .clone()
        .oneshot(
            axum::http::Request::post("/api/v1/tags")
                .header(auth_name.clone(), auth_value.clone())
                .header("Content-Type", "application/json")
                .body(AxumBody::from(
                    serde_json::json!({ "name": "Important", "color": "#8b5cf6" }).to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(tag_response.status(), StatusCode::OK);
    let tag_json = json_body(tag_response).await;
    let tag_id = tag_json["tag"]["id"].as_str().unwrap();

    let assign_response = app
        .clone()
        .oneshot(
            axum::http::Request::put(format!("/api/v1/files/{file_id}/tags"))
                .header(auth_name.clone(), auth_value.clone())
                .header("Content-Type", "application/json")
                .body(AxumBody::from(
                    serde_json::json!({ "tag_ids": [tag_id] }).to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(assign_response.status(), StatusCode::OK);

    let flags_response = app
        .clone()
        .oneshot(
            axum::http::Request::patch(format!("/api/v1/files/{file_id}/flags"))
                .header(auth_name.clone(), auth_value.clone())
                .header("Content-Type", "application/json")
                .body(AxumBody::from(
                    serde_json::json!({ "is_favorite": true, "is_pinned": true }).to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(flags_response.status(), StatusCode::OK);

    let favorites_response = app
        .clone()
        .oneshot(
            axum::http::Request::get("/api/v1/files?collection=favorites")
                .header(auth_name.clone(), auth_value.clone())
                .body(AxumBody::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(favorites_response.status(), StatusCode::OK);
    let favorites_json = json_body(favorites_response).await;
    assert_eq!(favorites_json["files"].as_array().unwrap().len(), 1);
    assert_eq!(favorites_json["files"][0]["tags"][0]["name"], "Important");
    assert_eq!(favorites_json["files"][0]["is_favorite"], true);
    assert_eq!(favorites_json["files"][0]["is_pinned"], true);

    let image_id = create_test_file(&pool, user_id, "diagram.png").await;
    sqlx::query("UPDATE files SET mime_type = 'image/png', is_favorite = TRUE WHERE id = $1")
        .bind(image_id)
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("INSERT INTO file_tag_assignments (user_id, file_id, tag_id) VALUES ($1, $2, $3)")
        .bind(user_id)
        .bind(image_id)
        .bind(tag_id.parse::<uuid::Uuid>().unwrap())
        .execute(&pool)
        .await
        .unwrap();

    let pinned_only_id = create_test_file(&pool, user_id, "pinned-only.txt").await;
    sqlx::query("UPDATE files SET is_pinned = TRUE WHERE id = $1")
        .bind(pinned_only_id)
        .execute(&pool)
        .await
        .unwrap();

    let favorite_pinned_response = app
        .clone()
        .oneshot(
            axum::http::Request::get("/api/v1/files?collection=favorites,pinned")
                .header(auth_name.clone(), auth_value.clone())
                .body(AxumBody::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(favorite_pinned_response.status(), StatusCode::OK);
    let favorite_pinned_json = json_body(favorite_pinned_response).await;
    assert_eq!(favorite_pinned_json["files"].as_array().unwrap().len(), 1);
    assert_eq!(favorite_pinned_json["files"][0]["id"], file_id.to_string());

    let combined_response = app
        .clone()
        .oneshot(
            axum::http::Request::get(format!(
                "/api/v1/files?collection=favorites,images&tag_id={tag_id}"
            ))
            .header(auth_name.clone(), auth_value.clone())
            .body(AxumBody::empty())
            .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(combined_response.status(), StatusCode::OK);
    let combined_json = json_body(combined_response).await;
    assert_eq!(combined_json["files"].as_array().unwrap().len(), 1);
    assert_eq!(combined_json["files"][0]["id"], image_id.to_string());

    let counts_response = app
        .clone()
        .oneshot(
            axum::http::Request::get("/api/v1/files/collection-counts")
                .header(auth_name.clone(), auth_value.clone())
                .body(AxumBody::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(counts_response.status(), StatusCode::OK);
    let counts_json = json_body(counts_response).await;
    assert_eq!(counts_json["collections"]["favorites"], 2);
    assert_eq!(counts_json["collections"]["images"], 1);
    assert_eq!(counts_json["collections"]["duplicates"], 0);
    assert_eq!(counts_json["tags"][tag_id], 2);

    let duplicates_response = app
        .oneshot(
            axum::http::Request::get("/api/v1/files?collection=duplicates")
                .header(auth_name, auth_value)
                .body(AxumBody::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(duplicates_response.status(), StatusCode::OK);
    let duplicates_json = json_body(duplicates_response).await;
    assert_eq!(duplicates_json["files"].as_array().unwrap().len(), 0);
}

#[tokio::test]
#[serial(productivity_features_db)]
async fn collection_counts_are_scoped_to_current_folder() {
    init_test_env();
    let pool = create_test_pool().await;
    cleanup_test_data(&pool).await;
    let (user_id, token) = login_and_get_token(&pool, "counts_folder_scope").await;
    let folder_id = create_test_folder(&pool, user_id, "scoped", None).await;
    let in_folder_a = create_test_file(&pool, user_id, "inside-a.png").await;
    let in_folder_b = create_test_file(&pool, user_id, "inside-b.png").await;
    let cross_scope_inside = create_test_file(&pool, user_id, "inside-single-copy.png").await;
    let cross_scope_outside = create_test_file(&pool, user_id, "outside-single-copy.png").await;
    let outside_a = create_test_file(&pool, user_id, "outside-a.mp4").await;
    let outside_b = create_test_file(&pool, user_id, "outside-b.mp4").await;

    sqlx::query(
        "UPDATE files SET folder_id = $1, content_sha256 = $2, mime_type = 'image/png' WHERE id = ANY($3)",
    )
    .bind(folder_id)
    .bind("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb")
    .bind([in_folder_a, in_folder_b])
    .execute(&pool)
    .await
    .unwrap();
    sqlx::query("UPDATE files SET content_sha256 = $1, mime_type = 'video/mp4' WHERE id = ANY($2)")
        .bind("cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc")
        .bind([outside_a, outside_b])
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query(
        "UPDATE files SET folder_id = $1, content_sha256 = $2, mime_type = 'image/png' WHERE id = $3",
    )
    .bind(folder_id)
    .bind("dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd")
    .bind(cross_scope_inside)
    .execute(&pool)
    .await
    .unwrap();
    sqlx::query("UPDATE files SET content_sha256 = $1, mime_type = 'image/png' WHERE id = $2")
        .bind("dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd")
        .bind(cross_scope_outside)
        .execute(&pool)
        .await
        .unwrap();

    let app = build_test_app(&pool).await;
    let (auth_name, auth_value) = bearer_auth_header(&token);
    let counts_response = app
        .oneshot(
            axum::http::Request::get(format!(
                "/api/v1/files/collection-counts?folder_id={folder_id}"
            ))
            .header(auth_name, auth_value)
            .body(AxumBody::empty())
            .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(counts_response.status(), StatusCode::OK);
    let counts_json = json_body(counts_response).await;
    assert_eq!(counts_json["collections"]["duplicates"], 2);
    assert_eq!(counts_json["collections"]["images"], 3);
    assert_eq!(counts_json["collections"]["videos"], 0);
}

#[tokio::test]
#[serial(productivity_features_db)]
async fn recent_collection_tracks_authenticated_preview_access() {
    init_test_env();
    let pool = create_test_pool().await;
    cleanup_test_data(&pool).await;
    let (user_id, token) = login_and_get_token(&pool, "recent_collection_owner").await;
    let app = build_test_app(&pool).await;
    let (auth_name, auth_value) = bearer_auth_header(&token);

    let boundary = "recent-upload-boundary";
    let body = multipart_body(boundary, &[], "recent-note.txt", "opened later");
    let upload_response = app
        .clone()
        .oneshot(
            axum::http::Request::post("/api/v1/files/upload")
                .header(
                    "Content-Type",
                    format!("multipart/form-data; boundary={boundary}"),
                )
                .header(auth_name.clone(), auth_value.clone())
                .body(AxumBody::from(body))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(upload_response.status(), StatusCode::OK);
    let upload_json = json_body(upload_response).await;
    let file_id = upload_json["file"]["id"].as_str().unwrap();

    let before_response = app
        .clone()
        .oneshot(
            axum::http::Request::get("/api/v1/files?collection=recent")
                .header(auth_name.clone(), auth_value.clone())
                .body(AxumBody::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(before_response.status(), StatusCode::OK);
    let before_json = json_body(before_response).await;
    assert_eq!(before_json["files"].as_array().unwrap().len(), 0);

    let preview_response = app
        .clone()
        .oneshot(
            axum::http::Request::get(format!("/api/v1/files/{file_id}/preview"))
                .header(auth_name.clone(), auth_value.clone())
                .body(AxumBody::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(preview_response.status(), StatusCode::OK);

    let one_hour_old_id = create_test_file(&pool, user_id, "opened-one-hour-ago.txt").await;
    let stale_id = create_test_file(&pool, user_id, "opened-eight-days-ago.txt").await;
    sqlx::query("UPDATE files SET last_opened_at = $1 WHERE id = $2")
        .bind(Utc::now() - Duration::hours(1))
        .bind(one_hour_old_id)
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("UPDATE files SET last_opened_at = $1 WHERE id = $2")
        .bind(Utc::now() - Duration::days(8))
        .bind(stale_id)
        .execute(&pool)
        .await
        .unwrap();

    let after_response = app
        .oneshot(
            axum::http::Request::get("/api/v1/files?collection=recent")
                .header(auth_name, auth_value)
                .body(AxumBody::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(after_response.status(), StatusCode::OK);
    let after_json = json_body(after_response).await;
    let files = after_json["files"].as_array().unwrap();
    assert_eq!(files.len(), 2);
    assert_eq!(after_json["files"][0]["id"], file_id);
    assert_eq!(after_json["files"][1]["id"], one_hour_old_id.to_string());
    assert_ne!(after_json["files"][0]["id"], stale_id.to_string());
    assert!(after_json["files"][0]["last_opened_at"].as_str().is_some());
}
