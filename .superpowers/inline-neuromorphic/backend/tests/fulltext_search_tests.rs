mod common;

use std::{fs, sync::Arc};

use axum::{
    body::{to_bytes, Body as AxumBody},
    http::StatusCode,
    Router,
};
use file_storage_backend::{
    app::create_app,
    config::Config,
    services::{
        fulltext_search::{SearchDocument, SearchIndexService},
        ocr::{OcrExtractor, OcrOptions, OcrStatus},
        storage::create_memory_backend,
        task_queue::{run_fulltext_index_worker, run_fulltext_remove_worker},
    },
    AppState,
};
use serial_test::serial;
use tower::ServiceExt;
use uuid::Uuid;

#[test]
fn fulltext_search_returns_snippets_and_enforces_user_isolation() {
    let service = SearchIndexService::open_in_memory().unwrap();
    let user_a = Uuid::new_v4();
    let user_b = Uuid::new_v4();
    service
        .upsert_document(SearchDocument {
            file_id: Uuid::new_v4(),
            user_id: user_a,
            filename: "notes.md".into(),
            path: "/notes.md".into(),
            extracted_text: "rust webdav searchable content".into(),
            ocr_text: String::new(),
            category: String::new(),
            mime_type: "text/markdown".into(),
        })
        .unwrap();
    service
        .upsert_document(SearchDocument {
            file_id: Uuid::new_v4(),
            user_id: user_b,
            filename: "secret.md".into(),
            path: "/secret.md".into(),
            extracted_text: "rust webdav searchable content".into(),
            ocr_text: String::new(),
            category: String::new(),
            mime_type: "text/markdown".into(),
        })
        .unwrap();

    let results = service.search(user_a, "webdav", 10, None, None).unwrap();
    assert_eq!(results.len(), 1);
    assert_eq!(results[0].filename, "notes.md");
    assert!(results[0].snippet.to_lowercase().contains("webdav"));
}

#[test]
fn fulltext_search_marks_ocr_text_as_ocr_source() {
    let service = SearchIndexService::open_in_memory().unwrap();
    let user_id = Uuid::new_v4();
    service
        .upsert_document(SearchDocument {
            file_id: Uuid::new_v4(),
            user_id,
            filename: "scan.png".into(),
            path: "/scan.png".into(),
            extracted_text: String::new(),
            ocr_text: "invoice number zebra-445".into(),
            category: String::new(),
            mime_type: "image/png".into(),
        })
        .unwrap();

    let results = service
        .search(user_id, "zebra-445", 10, None, None)
        .unwrap();

    assert_eq!(results.len(), 1);
    assert_eq!(results[0].match_source, "ocr");
}

#[test]
fn fulltext_search_tolerates_malformed_query_syntax() {
    let service = SearchIndexService::open_in_memory().unwrap();
    let user_id = Uuid::new_v4();
    service
        .upsert_document(SearchDocument {
            file_id: Uuid::new_v4(),
            user_id,
            filename: "notes.md".into(),
            path: "/notes.md".into(),
            extracted_text: "title field style text".into(),
            ocr_text: String::new(),
            category: String::new(),
            mime_type: "text/markdown".into(),
        })
        .unwrap();

    let results = service.search(user_id, "title:", 10, None, None).unwrap();
    assert!(results.is_empty());
}

#[test]
fn fulltext_search_filters_garbled_content_only_matches() {
    let service = SearchIndexService::open_in_memory().unwrap();
    let user_id = Uuid::new_v4();
    service
        .upsert_document(SearchDocument {
            file_id: Uuid::new_v4(),
            user_id,
            filename: "portrait.jpg".into(),
            path: "/portrait.jpg".into(),
            extracted_text: "bad \u{fffd}\u{fffd}\u{fffd} token".into(),
            ocr_text: String::new(),
            category: String::new(),
            mime_type: "image/jpeg".into(),
        })
        .unwrap();

    let results = service.search(user_id, "token", 10, None, None).unwrap();

    assert!(results.is_empty());
}

#[test]
fn persistent_search_index_allows_multiple_readers_before_writer_is_needed() {
    let index_dir = tempfile::tempdir().unwrap();
    let writer_service = SearchIndexService::open_or_create(index_dir.path()).unwrap();
    let reader_service = SearchIndexService::open_or_create(index_dir.path()).unwrap();
    let user_id = Uuid::new_v4();
    let file_id = Uuid::new_v4();

    writer_service
        .upsert_document(SearchDocument {
            file_id,
            user_id,
            filename: "shared-index.md".into(),
            path: "/shared-index.md".into(),
            extracted_text: "shared persistent index visibility".into(),
            ocr_text: String::new(),
            category: String::new(),
            mime_type: "text/markdown".into(),
        })
        .unwrap();

    let results = reader_service
        .search(user_id, "persistent", 10, None, None)
        .unwrap();

    assert_eq!(results.len(), 1);
    assert_eq!(results[0].file_id, file_id);
}

#[test]
fn ocr_extractor_skips_when_disabled_or_dependency_missing() {
    let disabled = OcrExtractor::extract(&[], "image/png", "scan.png", false, "tesseract").unwrap();
    assert_eq!(disabled.status, OcrStatus::Disabled);
    assert!(disabled.text.is_empty());

    let missing = OcrExtractor::extract(
        b"not a real image",
        "image/png",
        "scan.png",
        true,
        "/definitely/missing/tesseract",
    )
    .unwrap();
    assert_eq!(missing.status, OcrStatus::DependencyMissing);
    assert!(missing.text.is_empty());
}

#[test]
fn backend_docker_image_installs_ocr_runtime_dependencies() {
    let dockerfile = fs::read_to_string("Dockerfile").unwrap();

    assert!(dockerfile.contains("tesseract-ocr"));
    assert!(dockerfile.contains("poppler-utils"));
}

#[test]
fn pdf_ocr_converts_limited_pages_then_indexes_each_page_text() {
    let temp = tempfile::tempdir().unwrap();
    let pdftoppm = temp.path().join("pdftoppm");
    let tesseract = temp.path().join("tesseract");
    let args_file = temp.path().join("pdftoppm.args");

    fs::write(
        &pdftoppm,
        format!(
            "#!/bin/sh\nprintf '%s\\n' \"$@\" > '{}'\nfor last do :; done\nprintf page1 > \"${{last}}-1.png\"\nprintf page2 > \"${{last}}-2.png\"\n",
            args_file.display()
        ),
    )
    .unwrap();
    fs::write(
        &tesseract,
        "#!/bin/sh\necho \"ocr text from $(basename \"$1\")\"\n",
    )
    .unwrap();
    make_executable(&pdftoppm);
    make_executable(&tesseract);

    let outcome = OcrExtractor::extract_with_options(
        b"%PDF fake scan",
        "application/pdf",
        "scan.pdf",
        OcrOptions {
            enabled: true,
            tesseract_bin: tesseract.to_string_lossy().to_string(),
            pdftoppm_bin: pdftoppm.to_string_lossy().to_string(),
            pdf_max_pages: 2,
        },
    )
    .unwrap();

    assert_eq!(outcome.status, OcrStatus::Completed);
    assert!(outcome.text.contains("ocr text from page-1.png"));
    assert!(outcome.text.contains("ocr text from page-2.png"));
    let args = fs::read_to_string(args_file).unwrap();
    assert!(args.contains("-l\n2"));
}

#[test]
fn pdf_ocr_skips_when_poppler_dependency_is_missing() {
    let outcome = OcrExtractor::extract_with_options(
        b"%PDF fake scan",
        "application/pdf",
        "scan.pdf",
        OcrOptions {
            enabled: true,
            tesseract_bin: "tesseract".to_string(),
            pdftoppm_bin: "/definitely/missing/pdftoppm".to_string(),
            pdf_max_pages: 2,
        },
    )
    .unwrap();

    assert_eq!(outcome.status, OcrStatus::DependencyMissing);
    assert!(outcome.text.is_empty());
}

#[cfg(unix)]
fn make_executable(path: &std::path::Path) {
    use std::os::unix::fs::PermissionsExt;
    let mut permissions = fs::metadata(path).unwrap().permissions();
    permissions.set_mode(0o755);
    fs::set_permissions(path, permissions).unwrap();
}

#[cfg(not(unix))]
fn make_executable(_path: &std::path::Path) {}

#[tokio::test]
#[serial(fulltext_search_db)]
async fn fulltext_api_returns_files_contract_from_persistent_index() {
    common::init_test_env();
    let pool = common::create_test_pool().await;
    common::cleanup_test_data(&pool).await;

    let index_dir = tempfile::tempdir().unwrap();
    let (app, state) = build_fulltext_app(&pool, index_dir.path(), false).await;
    let (user_id, token) = common::app::login_and_get_token(&pool, "fulltext_api_contract").await;
    let file_id = common::create_test_file(&pool, user_id, "research.md").await;
    state
        .search_index
        .upsert_document(SearchDocument {
            file_id,
            user_id,
            filename: "research.md".into(),
            path: "/research.md".into(),
            extracted_text: "tantivy persistent content contract".into(),
            ocr_text: String::new(),
            category: String::new(),
            mime_type: "text/markdown".into(),
        })
        .unwrap();

    let json = search_fulltext(app, &token, "persistent").await;

    assert_eq!(json["query"], "persistent");
    assert_eq!(json["count"], 1);
    assert!(json.get("results").is_none());
    assert_eq!(json["files"][0]["file"]["id"], file_id.to_string());
    assert_eq!(json["files"][0]["file"]["file_size"], 1024);
    assert_eq!(json["files"][0]["match_source"], "content");
    assert!(json["files"][0]["snippet"]
        .as_str()
        .unwrap()
        .contains("persistent"));
    assert_eq!(json["search"]["index_status"], "ready");
    assert_eq!(json["search"]["ocr"]["enabled"], false);
    assert_eq!(json["search"]["ocr"]["tesseract_available"], false);
    assert_eq!(json["search"]["ocr"]["poppler_available"], false);
}

#[tokio::test]
#[serial(fulltext_search_db)]
async fn fulltext_api_applies_collection_and_tag_filters() {
    common::init_test_env();
    let pool = common::create_test_pool().await;
    common::cleanup_test_data(&pool).await;

    let index_dir = tempfile::tempdir().unwrap();
    let (app, state) = build_fulltext_app(&pool, index_dir.path(), false).await;
    let (user_id, token) = common::app::login_and_get_token(&pool, "fulltext_filters").await;
    let pinned_file = common::create_test_file(&pool, user_id, "pinned.md").await;
    let plain_file = common::create_test_file(&pool, user_id, "plain.md").await;
    let tag_id = Uuid::new_v4();
    sqlx::query("UPDATE files SET is_pinned = TRUE WHERE id = $1")
        .bind(pinned_file)
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query(
        "INSERT INTO file_tags (id, user_id, name, color) VALUES ($1, $2, 'Important', '#8b5cf6')",
    )
    .bind(tag_id)
    .bind(user_id)
    .execute(&pool)
    .await
    .unwrap();
    sqlx::query("INSERT INTO file_tag_assignments (user_id, file_id, tag_id) VALUES ($1, $2, $3)")
        .bind(user_id)
        .bind(pinned_file)
        .bind(tag_id)
        .execute(&pool)
        .await
        .unwrap();

    for (file_id, filename) in [(pinned_file, "pinned.md"), (plain_file, "plain.md")] {
        state
            .search_index
            .upsert_document(SearchDocument {
                file_id,
                user_id,
                filename: filename.into(),
                path: format!("/{filename}"),
                extracted_text: "shared collection-filter-token".into(),
                ocr_text: String::new(),
                category: String::new(),
                mime_type: "text/markdown".into(),
            })
            .unwrap();
    }

    let collection_json = search_fulltext_path(
        app.clone(),
        &token,
        "/api/v1/files/search/fulltext?q=collection-filter-token&collection=pinned",
    )
    .await;
    assert_eq!(collection_json["count"], 1);
    assert_eq!(
        collection_json["files"][0]["file"]["id"],
        pinned_file.to_string()
    );

    let tag_json = search_fulltext_path(
        app,
        &token,
        &format!("/api/v1/files/search/fulltext?q=collection-filter-token&tag_id={tag_id}"),
    )
    .await;
    assert_eq!(tag_json["count"], 1);
    assert_eq!(tag_json["files"][0]["file"]["id"], pinned_file.to_string());
}

#[tokio::test]
#[serial(fulltext_search_db)]
async fn fulltext_api_uses_filename_fallback_for_single_character_queries() {
    common::init_test_env();
    let pool = common::create_test_pool().await;
    common::cleanup_test_data(&pool).await;

    let index_dir = tempfile::tempdir().unwrap();
    let (app, state) = build_fulltext_app(&pool, index_dir.path(), true).await;
    let (user_id, token) = common::app::login_and_get_token(&pool, "fulltext_short_query").await;
    let filename_hit = common::create_test_file(&pool, user_id, "receipt-3.png").await;
    let ocr_only_hit = common::create_test_file(&pool, user_id, "scan.png").await;

    state
        .search_index
        .upsert_document(SearchDocument {
            file_id: filename_hit,
            user_id,
            filename: "receipt-3.png".into(),
            path: "/receipt-3.png".into(),
            extracted_text: String::new(),
            ocr_text: "invoice 3 paid".into(),
            category: String::new(),
            mime_type: "image/png".into(),
        })
        .unwrap();
    state
        .search_index
        .upsert_document(SearchDocument {
            file_id: ocr_only_hit,
            user_id,
            filename: "scan.png".into(),
            path: "/scan.png".into(),
            extracted_text: String::new(),
            ocr_text: "invoice 3 paid".into(),
            category: String::new(),
            mime_type: "image/png".into(),
        })
        .unwrap();

    let json = search_fulltext(app, &token, "3").await;

    assert_eq!(json["count"], 1);
    assert_eq!(json["search"]["index_status"], "fallback");
    assert_eq!(json["files"][0]["file"]["id"], filename_hit.to_string());
    assert_eq!(json["files"][0]["match_source"], "filename");
}

#[tokio::test]
#[serial(fulltext_search_db)]
async fn fulltext_filename_fallback_reports_total_and_honors_page_and_sort() {
    common::init_test_env();
    let pool = common::create_test_pool().await;
    common::cleanup_test_data(&pool).await;

    let index_dir = tempfile::tempdir().unwrap();
    let (app, _state) = build_fulltext_app(&pool, index_dir.path(), true).await;
    let (user_id, token) =
        common::app::login_and_get_token(&pool, "fulltext_fallback_page_sort").await;
    let alpha = common::create_test_file(&pool, user_id, "r-alpha.txt").await;
    let bravo = common::create_test_file(&pool, user_id, "r-bravo.txt").await;
    let charlie = common::create_test_file(&pool, user_id, "r-charlie.txt").await;
    let _miss = common::create_test_file(&pool, user_id, "plain.txt").await;

    let json = search_fulltext_path(
        app,
        &token,
        "/api/v1/files/search/fulltext?q=r&limit=2&page=2&sort_by=filename&sort_order=asc",
    )
    .await;

    assert_eq!(json["count"], 3);
    assert_eq!(json["search"]["count"], 3);
    assert_eq!(json["search"]["index_status"], "fallback");
    assert_eq!(json["files"].as_array().unwrap().len(), 1);
    assert_eq!(json["files"][0]["file"]["id"], charlie.to_string());
    assert_ne!(json["files"][0]["file"]["id"], alpha.to_string());
    assert_ne!(json["files"][0]["file"]["id"], bravo.to_string());
}

#[tokio::test]
#[serial(fulltext_search_db)]
async fn fulltext_filename_fallback_collection_counts_match_filtered_total() {
    common::init_test_env();
    let pool = common::create_test_pool().await;
    common::cleanup_test_data(&pool).await;

    let index_dir = tempfile::tempdir().unwrap();
    let (app, _state) = build_fulltext_app(&pool, index_dir.path(), true).await;
    let (user_id, token) =
        common::app::login_and_get_token(&pool, "fulltext_fallback_collection_total").await;

    for idx in 0..5 {
        let file_id = common::create_test_file(&pool, user_id, &format!("r-video-{idx}.mp4")).await;
        sqlx::query("UPDATE files SET mime_type = 'video/mp4' WHERE id = $1")
            .bind(file_id)
            .execute(&pool)
            .await
            .unwrap();
    }
    for idx in 0..3 {
        let file_id = common::create_test_file(&pool, user_id, &format!("r-image-{idx}.jpg")).await;
        sqlx::query("UPDATE files SET mime_type = 'image/jpeg' WHERE id = $1")
            .bind(file_id)
            .execute(&pool)
            .await
            .unwrap();
    }

    let json = search_fulltext_path(
        app,
        &token,
        "/api/v1/files/search/fulltext?q=r&limit=2&collection=videos&sort_by=type&sort_order=asc",
    )
    .await;

    assert_eq!(json["count"], 5);
    assert_eq!(json["search"]["count"], 5);
    assert_eq!(json["search"]["index_status"], "fallback");
    assert_eq!(json["files"].as_array().unwrap().len(), 2);
    assert!(json["files"]
        .as_array()
        .unwrap()
        .iter()
        .all(|item| item["file"]["mime_type"]
            .as_str()
            .unwrap()
            .starts_with("video/")));
}

#[tokio::test]
#[serial(fulltext_search_db)]
async fn fulltext_api_scopes_root_folder_searches_to_root_files() {
    common::init_test_env();
    let pool = common::create_test_pool().await;
    common::cleanup_test_data(&pool).await;

    let index_dir = tempfile::tempdir().unwrap();
    let (app, _state) = build_fulltext_app(&pool, index_dir.path(), true).await;
    let (user_id, token) = common::app::login_and_get_token(&pool, "fulltext_root_scope").await;
    let folder_id = common::create_test_folder(&pool, user_id, "nested", None).await;
    let root_hit = common::create_test_file(&pool, user_id, "root-3.png").await;
    let nested_hit = common::create_test_file(&pool, user_id, "nested-3.png").await;

    sqlx::query("UPDATE files SET folder_id = $1 WHERE id = $2")
        .bind(folder_id)
        .bind(nested_hit)
        .execute(&pool)
        .await
        .unwrap();

    let json = search_fulltext_path(
        app,
        &token,
        "/api/v1/files/search/fulltext?q=3&folder_id=root",
    )
    .await;

    assert_eq!(json["count"], 1);
    assert_eq!(json["search"]["index_status"], "fallback");
    assert_eq!(json["files"][0]["file"]["id"], root_hit.to_string());
}

#[tokio::test]
#[serial(fulltext_search_db)]
async fn fulltext_api_falls_back_when_folder_filtered_index_hits_are_empty() {
    common::init_test_env();
    let pool = common::create_test_pool().await;
    common::cleanup_test_data(&pool).await;

    let index_dir = tempfile::tempdir().unwrap();
    let (app, state) = build_fulltext_app(&pool, index_dir.path(), true).await;
    let (user_id, token) =
        common::app::login_and_get_token(&pool, "fulltext_folder_empty_index").await;
    let folder_id = common::create_test_folder(&pool, user_id, "nested", None).await;
    let root_index_hit = common::create_test_file(&pool, user_id, "root-only.md").await;
    let folder_hit = common::create_test_file(&pool, user_id, "folder-scope-token.md").await;

    sqlx::query("UPDATE files SET folder_id = $1 WHERE id = $2")
        .bind(folder_id)
        .bind(folder_hit)
        .execute(&pool)
        .await
        .unwrap();

    state
        .search_index
        .upsert_document(SearchDocument {
            file_id: root_index_hit,
            user_id,
            filename: "root-only.md".into(),
            path: "/root-only.md".into(),
            extracted_text: "folder-scope-token".into(),
            ocr_text: String::new(),
            category: String::new(),
            mime_type: "text/markdown".into(),
        })
        .unwrap();

    let json = search_fulltext_path(
        app,
        &token,
        &format!("/api/v1/files/search/fulltext?q=folder-scope-token&folder_id={folder_id}"),
    )
    .await;

    assert_eq!(json["count"], 1);
    assert_eq!(json["search"]["index_status"], "fallback");
    assert_eq!(json["files"][0]["file"]["id"], folder_hit.to_string());
}

#[tokio::test]
#[serial(fulltext_search_db)]
async fn fulltext_api_uses_filename_fallback_for_two_digit_queries() {
    common::init_test_env();
    let pool = common::create_test_pool().await;
    common::cleanup_test_data(&pool).await;

    let index_dir = tempfile::tempdir().unwrap();
    let (app, state) = build_fulltext_app(&pool, index_dir.path(), true).await;
    let (user_id, token) =
        common::app::login_and_get_token(&pool, "fulltext_two_digit_query").await;
    let filename_hit = common::create_test_file(&pool, user_id, "receipt-33.png").await;
    let ocr_only_hit = common::create_test_file(&pool, user_id, "scan.png").await;

    state
        .search_index
        .upsert_document(SearchDocument {
            file_id: filename_hit,
            user_id,
            filename: "receipt-33.png".into(),
            path: "/receipt-33.png".into(),
            extracted_text: String::new(),
            ocr_text: "invoice 33 paid".into(),
            category: String::new(),
            mime_type: "image/png".into(),
        })
        .unwrap();
    state
        .search_index
        .upsert_document(SearchDocument {
            file_id: ocr_only_hit,
            user_id,
            filename: "scan.png".into(),
            path: "/scan.png".into(),
            extracted_text: String::new(),
            ocr_text: "invoice 33 paid".into(),
            category: String::new(),
            mime_type: "image/png".into(),
        })
        .unwrap();

    let json = search_fulltext(app, &token, "33").await;

    assert_eq!(json["count"], 1);
    assert_eq!(json["search"]["index_status"], "fallback");
    assert_eq!(json["files"][0]["file"]["id"], filename_hit.to_string());
    assert_eq!(json["files"][0]["match_source"], "filename");
}

#[tokio::test]
#[serial(fulltext_search_db)]
async fn fulltext_api_returns_200_for_leniently_parsed_queries() {
    common::init_test_env();
    let pool = common::create_test_pool().await;
    common::cleanup_test_data(&pool).await;

    let index_dir = tempfile::tempdir().unwrap();
    let (app, _state) = build_fulltext_app(&pool, index_dir.path(), true).await;
    let (_user_id, token) = common::app::login_and_get_token(&pool, "fulltext_lenient_query").await;

    let json = search_fulltext_path(app, &token, "/api/v1/files/search/fulltext?q=title%3A").await;

    assert_eq!(json["query"], "title:");
    assert_eq!(json["count"], 0);
}

#[tokio::test]
#[serial(fulltext_search_db)]
async fn fulltext_rebuild_endpoint_enqueues_active_files_for_current_user() {
    common::init_test_env();
    let pool = common::create_test_pool().await;
    common::cleanup_test_data(&pool).await;

    let index_dir = tempfile::tempdir().unwrap();
    let (app, _state) = build_fulltext_app(&pool, index_dir.path(), false).await;
    let (user_id, token) = common::app::login_and_get_token(&pool, "fulltext_rebuild").await;
    let (other_user_id, _) =
        common::app::login_and_get_token(&pool, "fulltext_rebuild_other").await;
    let first_file = common::create_test_file(&pool, user_id, "first.txt").await;
    let second_file = common::create_test_file(&pool, user_id, "second.txt").await;
    let other_file = common::create_test_file(&pool, other_user_id, "other.txt").await;
    sqlx::query("UPDATE files SET deleted_at = NOW() WHERE id = $1")
        .bind(second_file)
        .execute(&pool)
        .await
        .unwrap();

    let (auth_name, auth_value) = common::app::bearer_auth_header(&token);
    let response = app
        .oneshot(
            axum::http::Request::post("/api/v1/files/search/fulltext/rebuild")
                .header(auth_name, auth_value)
                .body(AxumBody::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(json["queued"], 1);

    let queued_keys: Vec<String> = sqlx::query_scalar(
        "SELECT dedupe_key FROM background_tasks WHERE task_type = 'search_index_file' ORDER BY dedupe_key",
    )
    .fetch_all(&pool)
    .await
    .unwrap();
    assert_eq!(queued_keys, vec![format!("search:{first_file}")]);
    assert!(!queued_keys.contains(&format!("search:{second_file}")));
    assert!(!queued_keys.contains(&format!("search:{other_file}")));
}

#[tokio::test]
#[serial(fulltext_search_db)]
async fn upload_worker_indexes_content_for_fulltext_api() {
    common::init_test_env();
    let pool = common::create_test_pool().await;
    common::cleanup_test_data(&pool).await;

    let index_dir = tempfile::tempdir().unwrap();
    let (app, state) = build_fulltext_app(&pool, index_dir.path(), false).await;
    let (user_id, token) = common::app::login_and_get_token(&pool, "fulltext_upload").await;
    let file_id = upload_text(
        app.clone(),
        &token,
        "worker-note.txt",
        "Worker should index narwhal-persistent searchable text.",
    )
    .await;

    let queued: (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM background_tasks WHERE task_type = 'search_index_file' AND dedupe_key = $1")
            .bind(format!("search:{file_id}"))
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(queued.0, 1);

    run_fulltext_index_worker(&state).await.unwrap();

    let audit_events: Vec<(String, String, serde_json::Value)> = sqlx::query_as(
        "SELECT event_type, source, metadata FROM audit_events WHERE user_id = $1 AND file_id = $2 ORDER BY created_at ASC",
    )
    .bind(user_id)
    .bind(file_id)
    .fetch_all(&pool)
    .await
    .unwrap();
    assert!(audit_events
        .iter()
        .any(|(event_type, source, metadata)| event_type == "ocr.skipped"
            && source == "worker"
            && metadata["ocr_status"] == "disabled"));
    assert!(audit_events
        .iter()
        .any(
            |(event_type, source, metadata)| event_type == "fulltext.indexed"
                && source == "worker"
                && metadata["filename"] == "worker-note.txt"
        ));

    let json = search_fulltext(app, &token, "narwhal-persistent").await;
    assert_eq!(json["count"], 1);
    assert_eq!(json["files"][0]["file"]["id"], file_id.to_string());
    assert_eq!(json["files"][0]["match_source"], "content");
}

#[tokio::test]
#[serial(fulltext_search_db)]
async fn delete_worker_removes_file_from_fulltext_index() {
    common::init_test_env();
    let pool = common::create_test_pool().await;
    common::cleanup_test_data(&pool).await;

    let index_dir = tempfile::tempdir().unwrap();
    let (app, state) = build_fulltext_app(&pool, index_dir.path(), false).await;
    let (user_id, token) = common::app::login_and_get_token(&pool, "fulltext_delete").await;
    let file_id = upload_text(
        app,
        &token,
        "delete-note.txt",
        "Delete worker removes orchid-searchable text.",
    )
    .await;
    run_fulltext_index_worker(&state).await.unwrap();
    assert_eq!(
        state
            .search_index
            .search(user_id, "orchid-searchable", 10, None, None)
            .unwrap()
            .len(),
        1
    );

    state
        .file_service
        .delete_file(file_id, user_id)
        .await
        .unwrap();
    run_fulltext_remove_worker(&state).await.unwrap();

    assert!(state
        .search_index
        .search(user_id, "orchid-searchable", 10, None, None)
        .unwrap()
        .is_empty());
}

#[tokio::test]
#[serial(fulltext_search_db)]
async fn ocr_status_endpoint_reports_runtime_dependencies() {
    common::init_test_env();
    let pool = common::create_test_pool().await;
    common::cleanup_test_data(&pool).await;

    let index_dir = tempfile::tempdir().unwrap();
    let (app, _state) = build_fulltext_app(&pool, index_dir.path(), true).await;
    let (_user_id, token) = common::app::login_and_get_token(&pool, "ocr_status").await;
    let (auth_name, auth_value) = common::app::bearer_auth_header(&token);

    let response = app
        .oneshot(
            axum::http::Request::get("/api/v1/files/search/ocr/status")
                .header(auth_name, auth_value)
                .body(AxumBody::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(json["enabled"], true);
    assert_eq!(json["tesseract"]["available"], false);
    assert_eq!(json["poppler"]["available"], false);
    assert_eq!(json["pdf_max_pages"], 5);
}

async fn build_fulltext_app(
    pool: &sqlx::PgPool,
    index_path: &std::path::Path,
    ocr_enabled: bool,
) -> (Router, AppState) {
    let mut config = Config::default_for_test();
    config.search.fulltext_index_path = index_path.to_string_lossy().to_string();
    config.search.ocr_enabled = ocr_enabled;
    config.search.ocr_tesseract_bin = "/definitely/missing/tesseract".to_string();
    config.search.ocr_pdftoppm_bin = "/definitely/missing/pdftoppm".to_string();
    let config = Arc::new(config);
    let storage = Arc::new(create_memory_backend());
    let state = AppState::new(config.clone(), pool.clone(), pool.clone(), storage, None);
    let app = create_app(state.clone(), config.as_ref(), || "".to_string()).await;
    (app, state)
}

async fn upload_text(app: Router, token: &str, filename: &str, text: &str) -> Uuid {
    let boundary = "fulltext-boundary";
    let body = format!(
        "--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{filename}\"\r\nContent-Type: text/plain\r\n\r\n{text}\r\n--{boundary}--\r\n"
    );
    let (auth_name, auth_value) = common::app::bearer_auth_header(token);
    let response = app
        .oneshot(
            axum::http::Request::post("/api/v1/files/upload")
                .header(
                    "Content-Type",
                    format!("multipart/form-data; boundary={boundary}"),
                )
                .header(auth_name, auth_value)
                .body(AxumBody::from(body))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
    Uuid::parse_str(json["file"]["id"].as_str().unwrap()).unwrap()
}

async fn search_fulltext(app: Router, token: &str, query: &str) -> serde_json::Value {
    search_fulltext_path(
        app,
        token,
        &format!("/api/v1/files/search/fulltext?q={query}"),
    )
    .await
}

async fn search_fulltext_path(app: Router, token: &str, path: &str) -> serde_json::Value {
    let (auth_name, auth_value) = common::app::bearer_auth_header(token);
    let response = app
        .oneshot(
            axum::http::Request::get(path)
                .header(auth_name, auth_value)
                .body(AxumBody::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    serde_json::from_slice(&body).unwrap()
}
