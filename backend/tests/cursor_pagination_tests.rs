mod common;

use common::{cleanup_test_data, create_test_file, create_test_pool, create_test_user, init_test_env};
use file_storage_backend::models::file::FileListQuery;
use file_storage_backend::repositories::traits::FilesRepository;
use file_storage_backend::repositories::SqlxFilesRepo;
use std::collections::HashSet;

#[tokio::test]
async fn test_cursor_pagination_created_at_ties_no_duplicates() {
    init_test_env();
    let pool = create_test_pool().await;
    cleanup_test_data(&pool).await;

    let (user_id, _, _) = create_test_user(&pool, "cursor_ties").await;

    let mut ids = Vec::new();
    for i in 0..10 {
        ids.push(create_test_file(&pool, user_id, &format!("tie_{}.txt", i)).await);
    }

    sqlx::query("UPDATE files SET created_at = '2020-01-01T00:00:00Z' WHERE user_id = $1")
        .bind(user_id)
        .execute(&pool)
        .await
        .unwrap();

    let repo = SqlxFilesRepo::new(pool.clone());

    let mut seen = Vec::new();
    let mut cursor: Option<String> = None;

    loop {
        let query = FileListQuery {
            page: None,
            limit: Some(3),
            pagination: Some("cursor".to_string()),
            cursor: cursor.clone(),
            search: None,
            mime_type: None,
            category: None,
            folder_id: None,
            date_from: None,
            date_to: None,
            size_min: None,
            size_max: None,
            sort_by: None,
            sort_order: None,
            include_total: None,
        };

        let res = repo.list(user_id, query).await.unwrap();
        for f in &res.files {
            seen.push(f.id);
        }

        cursor = res.next_cursor.clone();
        if cursor.is_none() {
            break;
        }
    }

    let unique: HashSet<_> = seen.iter().cloned().collect();
    assert_eq!(unique.len(), seen.len());
    assert_eq!(unique.len(), ids.len());
}

