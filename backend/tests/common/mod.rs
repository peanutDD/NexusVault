//! # 测试公共模块
//!
//! 提供测试辅助函数和测试环境设置。

use sqlx::{postgres::PgPoolOptions, PgPool};
use std::sync::Once;

static INIT: Once = Once::new();

/// 初始化测试环境
///
/// 设置日志和环境变量
pub fn init_test_env() {
    INIT.call_once(|| {
        // 设置测试环境
        std::env::set_var("RUST_LOG", "debug");

        // 初始化 tracing（测试时）
        let _ = tracing_subscriber::fmt()
            .with_test_writer()
            .with_env_filter("debug")
            .try_init();
    });
}

/// 创建测试数据库连接池
///
/// 使用 DATABASE_URL 环境变量或默认测试数据库
pub async fn create_test_pool() -> PgPool {
    let database_url = std::env::var("DATABASE_URL").unwrap_or_else(|_| {
        "postgres://postgres:postgres@localhost:5432/file_storage_test".to_string()
    });

    PgPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await
        .expect("Failed to create test database pool")
}

/// 清理测试数据
///
/// 清空测试相关的数据表
pub async fn cleanup_test_data(pool: &PgPool) {
    // 按照外键依赖顺序清理
    let _ = sqlx::query("DELETE FROM file_shares").execute(pool).await;
    let _ = sqlx::query("DELETE FROM files").execute(pool).await;
    let _ = sqlx::query("DELETE FROM folders").execute(pool).await;
    let _ = sqlx::query("DELETE FROM upload_sessions")
        .execute(pool)
        .await;
    let _ = sqlx::query("DELETE FROM api_tokens").execute(pool).await;
    let _ = sqlx::query("DELETE FROM users WHERE email LIKE '%@test.com'")
        .execute(pool)
        .await;
}

/// 创建测试用户
///
/// 返回 (user_id, email, password)
pub async fn create_test_user(pool: &PgPool, suffix: &str) -> (uuid::Uuid, String, String) {
    let email = format!("test_{}@test.com", suffix);
    let username = format!("test_user_{}", suffix);
    let password = "test_password_123";

    // 使用 bcrypt 哈希密码
    let password_hash =
        bcrypt::hash(password, bcrypt::DEFAULT_COST).expect("Failed to hash password");

    let user_id: (uuid::Uuid,) = sqlx::query_as(
        "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id",
    )
    .bind(&username)
    .bind(&email)
    .bind(&password_hash)
    .fetch_one(pool)
    .await
    .expect("Failed to create test user");

    (user_id.0, email, password.to_string())
}

/// 创建测试文件记录
pub async fn create_test_file(pool: &PgPool, user_id: uuid::Uuid, filename: &str) -> uuid::Uuid {
    let file_id = uuid::Uuid::new_v4();
    let file_path = format!("/test/{}/{}", user_id, file_id);

    sqlx::query(
        "INSERT INTO files (id, user_id, filename, original_filename, file_path, file_size, mime_type, storage_backend) \
         VALUES ($1, $2, $3, $3, $4, 1024, 'application/octet-stream', 'local')"
    )
    .bind(file_id)
    .bind(user_id)
    .bind(filename)
    .bind(&file_path)
    .execute(pool)
    .await
    .expect("Failed to create test file");

    file_id
}

/// 创建测试文件夹
pub async fn create_test_folder(
    pool: &PgPool,
    user_id: uuid::Uuid,
    name: &str,
    parent_id: Option<uuid::Uuid>,
) -> uuid::Uuid {
    let folder_id: (uuid::Uuid,) = sqlx::query_as(
        "INSERT INTO folders (user_id, name, parent_id) VALUES ($1, $2, $3) RETURNING id",
    )
    .bind(user_id)
    .bind(name)
    .bind(parent_id)
    .fetch_one(pool)
    .await
    .expect("Failed to create test folder");

    folder_id.0
}
