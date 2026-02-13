//! # Repository 层测试
//!
//! 测试数据访问层的各个 Repository。

mod common;

use common::{
    cleanup_test_data, create_test_file, create_test_folder, create_test_pool, create_test_user,
    init_test_env,
};

/// 测试用户 Repository
#[tokio::test]
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
