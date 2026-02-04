//! # 认证服务测试
//!
//! 测试用户注册、登录、Token 验证等功能。

mod common;

use common::{cleanup_test_data, create_test_pool, init_test_env};

/// 测试用户注册
#[tokio::test]
async fn test_user_registration() {
    init_test_env();
    let pool = create_test_pool().await;
    cleanup_test_data(&pool).await;
    
    // 测试数据
    let username = "test_register_user";
    let email = "register@test.com";
    let password = "secure_password_123";
    
    // 使用 bcrypt 哈希密码
    let password_hash = bcrypt::hash(password, bcrypt::DEFAULT_COST).unwrap();
    
    // 创建用户
    let result = sqlx::query(
        "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3)"
    )
    .bind(username)
    .bind(email)
    .bind(&password_hash)
    .execute(&pool)
    .await;
    
    assert!(result.is_ok(), "User registration should succeed");
    
    // 验证用户存在
    let user: Option<(String,)> = sqlx::query_as(
        "SELECT email FROM users WHERE email = $1"
    )
    .bind(email)
    .fetch_optional(&pool)
    .await
    .unwrap();
    
    assert!(user.is_some(), "User should exist after registration");
    assert_eq!(user.unwrap().0, email);
}

/// 测试密码验证
#[tokio::test]
async fn test_password_verification() {
    init_test_env();
    
    let password = "my_secure_password";
    let password_hash = bcrypt::hash(password, bcrypt::DEFAULT_COST).unwrap();
    
    // 正确密码
    assert!(bcrypt::verify(password, &password_hash).unwrap());
    
    // 错误密码
    assert!(!bcrypt::verify("wrong_password", &password_hash).unwrap());
}

/// 测试重复注册应该失败
#[tokio::test]
async fn test_duplicate_registration() {
    init_test_env();
    let pool = create_test_pool().await;
    cleanup_test_data(&pool).await;
    
    let username = "duplicate_user";
    let email = "duplicate@test.com";
    let password_hash = bcrypt::hash("password123", bcrypt::DEFAULT_COST).unwrap();
    
    // 第一次注册
    let first = sqlx::query(
        "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3)"
    )
    .bind(username)
    .bind(email)
    .bind(&password_hash)
    .execute(&pool)
    .await;
    
    assert!(first.is_ok());
    
    // 第二次注册同一邮箱应该失败
    let second = sqlx::query(
        "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3)"
    )
    .bind("another_user")
    .bind(email)  // 同一邮箱
    .bind(&password_hash)
    .execute(&pool)
    .await;
    
    assert!(second.is_err(), "Duplicate email should fail");
}
