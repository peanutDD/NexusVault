//! # Repository 层测试
//!
//! 测试数据访问层的各个 Repository。

mod common;

use common::{
    cleanup_test_data, create_test_file, create_test_folder, create_test_pool, create_test_user,
    init_test_env,
};
use file_storage_backend::repositories::audit_events::{
    AuditEventListFilters, AuditEventsRepo, CreateAuditEvent,
};
use serde_json::json;
use serial_test::serial;

/// 测试用户 Repository
#[tokio::test]
#[serial(repository_db)]
async fn test_users_repo_find_by_email() {
    init_test_env();
    let pool = create_test_pool().await;
    cleanup_test_data(&pool).await;

    // 创建测试用户
    let (user_id, email, _) = create_test_user(&pool, "find_email").await;

    // 查询用户
    let found: Option<(uuid::Uuid,)> = sqlx::query_as("SELECT id FROM users WHERE email = $1")
        .bind(&email)
        .fetch_optional(&pool)
        .await
        .unwrap();

    assert!(found.is_some());
    assert_eq!(found.unwrap().0, user_id);
}

/// 测试文件 Repository
#[tokio::test]
#[serial(repository_db)]
async fn test_files_repo_crud() {
    init_test_env();
    let pool = create_test_pool().await;
    cleanup_test_data(&pool).await;

    // 创建测试用户和文件
    let (user_id, _, _) = create_test_user(&pool, "files_crud").await;
    let file_id = create_test_file(&pool, user_id, "test_file.txt").await;

    // 查询文件
    let file: Option<(uuid::Uuid, String)> =
        sqlx::query_as("SELECT id, filename FROM files WHERE id = $1 AND user_id = $2")
            .bind(file_id)
            .bind(user_id)
            .fetch_optional(&pool)
            .await
            .unwrap();

    assert!(file.is_some());
    let (id, filename) = file.unwrap();
    assert_eq!(id, file_id);
    assert_eq!(filename, "test_file.txt");

    // 删除文件
    let deleted = sqlx::query("DELETE FROM files WHERE id = $1 AND user_id = $2")
        .bind(file_id)
        .bind(user_id)
        .execute(&pool)
        .await
        .unwrap();

    assert_eq!(deleted.rows_affected(), 1);
}

/// 测试文件夹 Repository
#[tokio::test]
#[serial(repository_db)]
async fn test_folders_repo_hierarchy() {
    init_test_env();
    let pool = create_test_pool().await;
    cleanup_test_data(&pool).await;

    // 创建测试用户
    let (user_id, _, _) = create_test_user(&pool, "folders_hier").await;

    // 创建父文件夹
    let parent_id = create_test_folder(&pool, user_id, "Parent", None).await;

    // 创建子文件夹
    let child_id = create_test_folder(&pool, user_id, "Child", Some(parent_id)).await;

    // 验证层级关系
    let child: Option<(uuid::Uuid, Option<uuid::Uuid>)> =
        sqlx::query_as("SELECT id, parent_id FROM folders WHERE id = $1")
            .bind(child_id)
            .fetch_optional(&pool)
            .await
            .unwrap();

    assert!(child.is_some());
    let (id, parent) = child.unwrap();
    assert_eq!(id, child_id);
    assert_eq!(parent, Some(parent_id));
}

/// 测试文件列表查询
#[tokio::test]
#[serial(repository_db)]
async fn test_files_repo_list() {
    init_test_env();
    let pool = create_test_pool().await;
    cleanup_test_data(&pool).await;

    // 创建测试用户
    let (user_id, _, _) = create_test_user(&pool, "files_list").await;

    // 创建多个文件
    create_test_file(&pool, user_id, "file1.txt").await;
    create_test_file(&pool, user_id, "file2.txt").await;
    create_test_file(&pool, user_id, "file3.txt").await;

    // 查询文件列表
    let files: Vec<(uuid::Uuid,)> =
        sqlx::query_as("SELECT id FROM files WHERE user_id = $1 ORDER BY created_at")
            .bind(user_id)
            .fetch_all(&pool)
            .await
            .unwrap();

    assert_eq!(files.len(), 3);
}

/// 测试分页查询
#[tokio::test]
#[serial(repository_db)]
async fn test_files_repo_pagination() {
    init_test_env();
    let pool = create_test_pool().await;
    cleanup_test_data(&pool).await;

    // 创建测试用户
    let (user_id, _, _) = create_test_user(&pool, "files_page").await;

    // 创建 5 个文件
    for i in 1..=5 {
        create_test_file(&pool, user_id, &format!("page_file_{}.txt", i)).await;
    }

    // 第一页（2 条记录）
    let page1: Vec<(uuid::Uuid,)> = sqlx::query_as(
        "SELECT id FROM files WHERE user_id = $1 ORDER BY created_at LIMIT 2 OFFSET 0",
    )
    .bind(user_id)
    .fetch_all(&pool)
    .await
    .unwrap();

    assert_eq!(page1.len(), 2);

    // 第二页（2 条记录）
    let page2: Vec<(uuid::Uuid,)> = sqlx::query_as(
        "SELECT id FROM files WHERE user_id = $1 ORDER BY created_at LIMIT 2 OFFSET 2",
    )
    .bind(user_id)
    .fetch_all(&pool)
    .await
    .unwrap();

    assert_eq!(page2.len(), 2);

    // 第三页（1 条记录）
    let page3: Vec<(uuid::Uuid,)> = sqlx::query_as(
        "SELECT id FROM files WHERE user_id = $1 ORDER BY created_at LIMIT 2 OFFSET 4",
    )
    .bind(user_id)
    .fetch_all(&pool)
    .await
    .unwrap();

    assert_eq!(page3.len(), 1);
}

#[tokio::test]
#[serial(repository_db)]
async fn test_audit_events_repo_sanitizes_metadata_and_filters_by_user() {
    init_test_env();
    let pool = create_test_pool().await;
    cleanup_test_data(&pool).await;

    let (owner_id, _, _) = create_test_user(&pool, "audit_owner").await;
    let (other_id, _, _) = create_test_user(&pool, "audit_other").await;
    let owner_file_id = create_test_file(&pool, owner_id, "audit-owner.txt").await;
    let other_file_id = create_test_file(&pool, other_id, "audit-other.txt").await;
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
        ip_address: Some("127.0.0.1"),
        user_agent: Some("test-agent"),
        metadata: json!({
            "filename": "audit-owner.txt",
            "token": "must-not-persist",
            "Authorization": "Bearer must-not-persist",
            "nested": {
                "password": "must-not-persist",
                "safe": "kept"
            }
        }),
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
        metadata: json!({ "filename": "audit-other.txt" }),
    })
    .await
    .unwrap();

    let first_page = repo
        .list(
            owner_id,
            AuditEventListFilters {
                source: None,
                event_type: None,
                target_type: Some("file".to_string()),
                file_id: Some(owner_file_id),
                folder_id: None,
                share_id: None,
                file_request_id: None,
                api_token_id: None,
                date_from: None,
                date_to: None,
            },
            None,
            1,
        )
        .await
        .unwrap();

    assert_eq!(first_page.events.len(), 1);
    assert!(first_page.next_cursor.is_some());
    assert_ne!(first_page.events[0].user_id, other_id);

    let second_page = repo
        .list(
            owner_id,
            AuditEventListFilters {
                source: None,
                event_type: None,
                target_type: Some("file".to_string()),
                file_id: Some(owner_file_id),
                folder_id: None,
                share_id: None,
                file_request_id: None,
                api_token_id: None,
                date_from: None,
                date_to: None,
            },
            first_page.next_cursor,
            10,
        )
        .await
        .unwrap();

    assert_eq!(second_page.events.len(), 1);
    let upload_event = second_page
        .events
        .iter()
        .chain(first_page.events.iter())
        .find(|event| event.event_type == "file.uploaded")
        .unwrap();
    assert_eq!(upload_event.metadata["filename"], "audit-owner.txt");
    assert!(upload_event.metadata.get("token").is_none());
    assert!(upload_event.metadata.get("Authorization").is_none());
    assert!(upload_event.metadata["nested"].get("password").is_none());
    assert_eq!(upload_event.metadata["nested"]["safe"], "kept");
}

#[tokio::test]
#[serial(repository_db)]
async fn test_audit_events_repo_filters_by_api_token_id() {
    init_test_env();
    let pool = create_test_pool().await;
    cleanup_test_data(&pool).await;

    let (owner_id, _, _) = create_test_user(&pool, "audit_token_owner").await;
    let token_id: uuid::Uuid = sqlx::query_scalar(
        "INSERT INTO api_tokens (user_id, token_hash, token_prefix, name)
         VALUES ($1, $2, $3, $4)
         RETURNING id",
    )
    .bind(owner_id)
    .bind("audit-token-hash")
    .bind("audittok")
    .bind("WebDAV token")
    .fetch_one(&pool)
    .await
    .unwrap();

    let file_id = create_test_file(&pool, owner_id, "webdav-token.txt").await;
    let repo = AuditEventsRepo::new(&pool);
    repo.create(CreateAuditEvent {
        user_id: owner_id,
        actor_type: "api_token",
        actor_user_id: Some(owner_id),
        source: "webdav",
        event_type: "webdav.put",
        target_type: "webdav_path",
        file_id: Some(file_id),
        folder_id: None,
        share_id: None,
        file_request_id: None,
        api_token_id: Some(token_id),
        status: Some(201),
        ip_address: None,
        user_agent: None,
        metadata: json!({ "path": "/webdav-token.txt" }),
    })
    .await
    .unwrap();

    let page = repo
        .list(
            owner_id,
            AuditEventListFilters {
                source: Some("webdav".to_string()),
                event_type: None,
                target_type: None,
                file_id: None,
                folder_id: None,
                share_id: None,
                file_request_id: None,
                api_token_id: Some(token_id),
                date_from: None,
                date_to: None,
            },
            None,
            10,
        )
        .await
        .unwrap();

    assert_eq!(page.events.len(), 1);
    assert_eq!(page.events[0].api_token_id, Some(token_id));
}
