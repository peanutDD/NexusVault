//! # 缓存服务层测试
//!
//! 测试 Redis 缓存服务的核心功能：
//! - 用户缓存版本管理
//! - 文件列表缓存
//! - 缓存失效

mod common;

use std::sync::Arc;

use common::{
    cleanup_test_data, create_test_file, create_test_pool, create_test_user, init_test_env,
};
use deadpool_redis::Pool;
use file_storage_backend::{
    config::{CacheConfig, Config},
    models::file::FileListQuery,
    repositories::{
        DynFileVersionsRepo, DynFilesRepo, DynUsersRepo, SqlxFileVersionsRepo, SqlxFilesRepo,
        SqlxUsersRepo,
    },
    services::file::FileService,
    services::redis::RedisService,
    services::storage::{LocalStorage, StorageBackend},
};

// ============================================================================
// Redis 连接辅助函数
// ============================================================================

fn create_redis_pool() -> Option<Pool> {
    // 如果环境变量未设置，跳过 Redis 测试
    let redis_url = std::env::var("REDIS_URL").ok()?;
    let cfg = deadpool_redis::Config::from_url(redis_url);
    let pool = cfg
        .create_pool(Some(deadpool_redis::Runtime::Tokio1))
        .ok()?;
    Some(pool)
}

// ============================================================================
// 测试辅助函数：创建测试 FileService
// ============================================================================

async fn create_test_service(pool: sqlx::PgPool) -> FileService {
    let config = Arc::new(Config::from_env().unwrap());
    let storage: Arc<dyn StorageBackend> = Arc::new(LocalStorage::new(config.storage.path.clone()));

    let files_repo: DynFilesRepo =
        Arc::new(SqlxFilesRepo::new_with_replica(pool.clone(), pool.clone()));
    let users_repo: DynUsersRepo = Arc::new(SqlxUsersRepo::new(pool.clone()));
    let file_versions_repo: DynFileVersionsRepo = Arc::new(SqlxFileVersionsRepo::new(pool.clone()));

    FileService::new(
        files_repo,
        file_versions_repo,
        users_repo,
        pool,
        storage,
        config,
        None,
    )
}

// ============================================================================
// Redis 服务测试
// ============================================================================

#[tokio::test]
async fn test_redis_service_get_user_cache_version() {
    init_test_env();
    let Some(redis_pool) = create_redis_pool() else {
        println!("Skipping Redis test: REDIS_URL not set");
        return;
    };

    let redis = RedisService::new(redis_pool);
    let user_id = uuid::Uuid::new_v4();

    // 第一次获取，应该返回默认值 1
    let result = redis.get_user_cache_version(user_id).await;
    assert!(result.is_ok());
    let ver = result.unwrap();
    assert_eq!(ver, 1);
}

#[tokio::test]
async fn test_redis_service_bump_user_cache_version() {
    init_test_env();
    let Some(redis_pool) = create_redis_pool() else {
        println!("Skipping Redis test: REDIS_URL not set");
        return;
    };

    let redis = RedisService::new(redis_pool);
    let user_id = uuid::Uuid::new_v4();

    // 获取初始版本
    let ver1 = redis.get_user_cache_version(user_id).await.unwrap();
    assert_eq!(ver1, 1);

    // bump 版本
    let ver2 = redis.bump_user_cache_version(user_id).await.unwrap();
    assert_eq!(ver2, 2);

    // 再次获取应该是新的版本
    let ver3 = redis.get_user_cache_version(user_id).await.unwrap();
    assert_eq!(ver3, 2);

    // bump 两次
    let ver4 = redis.bump_user_cache_version(user_id).await.unwrap();
    let ver5 = redis.bump_user_cache_version(user_id).await.unwrap();
    assert_eq!(ver4, 3);
    assert_eq!(ver5, 4);
}

#[tokio::test]
async fn test_redis_service_bump_multiple_users_independent() {
    init_test_env();
    let Some(redis_pool) = create_redis_pool() else {
        println!("Skipping Redis test: REDIS_URL not set");
        return;
    };

    let redis = RedisService::new(redis_pool);
    let user1 = uuid::Uuid::new_v4();
    let user2 = uuid::Uuid::new_v4();

    // 用户 1 bump 两次
    redis.bump_user_cache_version(user1).await.unwrap();
    redis.bump_user_cache_version(user1).await.unwrap();

    // 用户 2 应该还是初始版本
    let ver2 = redis.get_user_cache_version(user2).await.unwrap();
    assert_eq!(ver2, 1);

    // 用户 1 应该是 3
    let ver1 = redis.get_user_cache_version(user1).await.unwrap();
    assert_eq!(ver1, 3);
}

// ============================================================================
// 文件列表缓存测试
// ============================================================================

#[tokio::test]
async fn test_file_service_list_files_cache_happy_path() {
    init_test_env();
    let pool = create_test_pool().await;
    cleanup_test_data(&pool).await;

    let Some(redis_pool) = create_redis_pool() else {
        println!("Skipping Redis test: REDIS_URL not set");
        return;
    };

    let (user_id, _, _) = create_test_user(&pool, "cache_list").await;
    create_test_file(&pool, user_id, "file1.txt").await;
    create_test_file(&pool, user_id, "file2.txt").await;

    let service = create_test_service(pool.clone()).await;
    let cache_config = CacheConfig {
        enabled: true,
        default_ttl_secs: 300,
        list_ttl_secs: 60,
    };

    // 第一次查询（应该写入缓存）
    let query = FileListQuery::default();
    let result1 = service
        .list_files_cached(user_id, query.clone(), Some(&redis_pool), &cache_config)
        .await;
    assert!(result1.is_ok());
    let (files1, total1, _) = result1.unwrap();
    assert_eq!(files1.len(), 2);
    assert_eq!(total1, Some(2));

    // 第二次查询（应该从缓存获取）
    let result2 = service
        .list_files_cached(user_id, query.clone(), Some(&redis_pool), &cache_config)
        .await;
    assert!(result2.is_ok());
    let (files2, total2, _) = result2.unwrap();
    assert_eq!(files2.len(), 2);
    assert_eq!(total2, Some(2));
}

#[tokio::test]
async fn test_file_service_list_files_cache_disabled() {
    init_test_env();
    let pool = create_test_pool().await;
    cleanup_test_data(&pool).await;

    let (user_id, _, _) = create_test_user(&pool, "cache_disabled").await;
    create_test_file(&pool, user_id, "file1.txt").await;

    let service = create_test_service(pool.clone()).await;
    let cache_config = CacheConfig {
        enabled: false, // 缓存禁用
        default_ttl_secs: 300,
        list_ttl_secs: 60,
    };

    // 应该直接查询数据库，不涉及缓存
    let query = FileListQuery::default();
    let result = service
        .list_files_cached(user_id, query, None, &cache_config)
        .await;
    assert!(result.is_ok());
    let (files, total, _) = result.unwrap();
    assert_eq!(files.len(), 1);
    assert_eq!(total, Some(1));
}

#[tokio::test]
async fn test_file_service_list_files_cache_not_page_1() {
    init_test_env();
    let pool = create_test_pool().await;
    cleanup_test_data(&pool).await;

    let Some(redis_pool) = create_redis_pool() else {
        println!("Skipping Redis test: REDIS_URL not set");
        return;
    };

    let (user_id, _, _) = create_test_user(&pool, "cache_page2").await;
    for i in 1..=5 {
        create_test_file(&pool, user_id, &format!("file{}.txt", i)).await;
    }

    let service = create_test_service(pool.clone()).await;
    let cache_config = CacheConfig {
        enabled: true,
        default_ttl_secs: 300,
        list_ttl_secs: 60,
    };

    // 第 2 页不应该缓存
    let query = FileListQuery {
        page: Some(2),
        limit: Some(2),
        ..Default::default()
    };
    let result = service
        .list_files_cached(user_id, query, Some(&redis_pool), &cache_config)
        .await;
    assert!(result.is_ok());
}

#[tokio::test]
async fn test_file_service_list_files_cache_with_search_not_cached() {
    init_test_env();
    let pool = create_test_pool().await;
    cleanup_test_data(&pool).await;

    let Some(redis_pool) = create_redis_pool() else {
        println!("Skipping Redis test: REDIS_URL not set");
        return;
    };

    let (user_id, _, _) = create_test_user(&pool, "cache_search").await;
    create_test_file(&pool, user_id, "important.txt").await;

    let service = create_test_service(pool.clone()).await;
    let cache_config = CacheConfig {
        enabled: true,
        default_ttl_secs: 300,
        list_ttl_secs: 60,
    };

    // 带搜索参数不应该缓存
    let query = FileListQuery {
        search: Some("important".to_string()),
        ..Default::default()
    };
    let result = service
        .list_files_cached(user_id, query, Some(&redis_pool), &cache_config)
        .await;
    assert!(result.is_ok());
}

// ============================================================================
// 缓存失效测试
// ============================================================================

#[tokio::test]
async fn test_file_service_cache_invalidation_after_write() {
    init_test_env();
    let pool = create_test_pool().await;
    cleanup_test_data(&pool).await;

    let Some(redis_pool) = create_redis_pool() else {
        println!("Skipping Redis test: REDIS_URL not set");
        return;
    };

    let redis = RedisService::new(redis_pool.clone());
    let (user_id, _, _) = create_test_user(&pool, "cache_invalidate").await;
    let _file_id = create_test_file(&pool, user_id, "file1.txt").await;

    let service = create_test_service(pool.clone()).await;
    let cache_config = CacheConfig {
        enabled: true,
        default_ttl_secs: 300,
        list_ttl_secs: 60,
    };

    // 第一次查询，设置缓存
    let query = FileListQuery::default();
    service
        .list_files_cached(user_id, query.clone(), Some(&redis_pool), &cache_config)
        .await
        .unwrap();

    // 获取当前版本
    let ver1 = redis.get_user_cache_version(user_id).await.unwrap();

    // 执行写操作（模拟）：bump 版本
    let ver2 = redis.bump_user_cache_version(user_id).await.unwrap();
    assert_eq!(ver2, ver1 + 1);

    // 再次查询，应该使用新的版本号，旧缓存自动失效
    let result = service
        .list_files_cached(user_id, query, Some(&redis_pool), &cache_config)
        .await;
    assert!(result.is_ok());
}
