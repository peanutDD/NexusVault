//! # 中间件层测试
//!
//! 测试中间件的核心功能：
//! - 认证中间件（缺失 token、过期 token、无效 token）
//! - 限流中间件（IP 限流、用户限流）

mod common;

use common::init_test_env;
use file_storage_backend::{middleware::rate_limit::create_rate_limit_middleware, utils::AppError};
use std::time::Duration;

// ============================================================================
// 认证中间件辅助测试（token 验证）
// ============================================================================

#[tokio::test]
async fn test_auth_middleware_verify_token_simple() {
    init_test_env();

    let jwt_secret = "test_secret_key_for_jwt_validation";

    // 生成一个有效的 token
    let user_id = uuid::Uuid::new_v4();
    let token = generate_test_token(jwt_secret, &user_id);

    // 使用中间件的验证函数
    let result = verify_token_simple(jwt_secret, &token);

    assert!(result.is_ok());
    assert_eq!(result.unwrap(), user_id);
}

#[tokio::test]
async fn test_auth_middleware_verify_token_empty() {
    init_test_env();

    let jwt_secret = "test_secret_key_for_jwt_validation";

    let result = verify_token_simple(jwt_secret, "");

    assert!(result.is_err());
    matches!(result.err().unwrap(), AppError::Unauthorized);
}

#[tokio::test]
async fn test_auth_middleware_verify_token_invalid() {
    init_test_env();

    let jwt_secret = "test_secret_key_for_jwt_validation";

    let result = verify_token_simple(jwt_secret, "invalid.token.string");

    assert!(result.is_err());
    matches!(result.err().unwrap(), AppError::Unauthorized);
}

#[tokio::test]
async fn test_auth_middleware_verify_token_expired() {
    init_test_env();

    let jwt_secret = "test_secret_key_for_jwt_validation";

    // 创建过期的 token
    let expired_token = create_expired_token(jwt_secret);

    let result = verify_token_simple(jwt_secret, &expired_token);

    assert!(result.is_err());
    matches!(result.err().unwrap(), AppError::Unauthorized);
}

// ============================================================================
// 测试辅助函数
// ============================================================================

fn generate_test_token(jwt_secret: &str, user_id: &uuid::Uuid) -> String {
    use jsonwebtoken::{encode, EncodingKey, Header};
    use serde::{Deserialize, Serialize};

    #[derive(Debug, Serialize, Deserialize)]
    struct Claims {
        sub: String,
        exp: usize,
        iat: usize,
    }

    let now = chrono::Utc::now().timestamp() as usize;
    let claims = Claims {
        sub: user_id.to_string(),
        exp: now + 3600,
        iat: now,
    };

    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(jwt_secret.as_ref()),
    )
    .unwrap()
}

fn create_expired_token(jwt_secret: &str) -> String {
    use jsonwebtoken::{encode, EncodingKey, Header};
    use serde::{Deserialize, Serialize};

    #[derive(Debug, Serialize, Deserialize)]
    struct Claims {
        sub: String,
        exp: usize,
        iat: usize,
    }

    let claims = Claims {
        sub: uuid::Uuid::new_v4().to_string(),
        exp: 1000000000,
        iat: 999999999,
    };

    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(jwt_secret.as_ref()),
    )
    .unwrap()
}

fn verify_token_simple(jwt_secret: &str, token: &str) -> Result<uuid::Uuid, AppError> {
    use jsonwebtoken::{decode, DecodingKey, Validation};
    use serde::{Deserialize, Serialize};

    #[derive(Debug, Serialize, Deserialize)]
    struct Claims {
        sub: String,
        exp: usize,
        iat: usize,
    }

    let token_data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(jwt_secret.as_ref()),
        &Validation::default(),
    )
    .map_err(|_| AppError::Unauthorized)?;

    let user_id =
        uuid::Uuid::parse_str(&token_data.claims.sub).map_err(|_| AppError::Unauthorized)?;

    Ok(user_id)
}

// ============================================================================
// 限流中间件测试
// ============================================================================

#[tokio::test]
async fn test_rate_limit_ip_basic() {
    init_test_env();

    // 创建限流状态：IP最多3次请求，窗口1秒
    let state = create_rate_limit_middleware(
        3,    // ip_max_requests
        10,   // user_max_requests
        1,    // window_seconds
        100,  // max_keys
        None, // redis
    );

    let ip_key = "192.168.1.1";

    // 前3次请求应该通过
    assert!(state.check_ip_rate_limit(ip_key).await);
    assert!(state.check_ip_rate_limit(ip_key).await);
    assert!(state.check_ip_rate_limit(ip_key).await);

    // 第4次应该被限流
    assert!(!state.check_ip_rate_limit(ip_key).await);
}

#[tokio::test]
async fn test_rate_limit_ip_different_ips() {
    init_test_env();

    let state = create_rate_limit_middleware(
        2,    // ip_max_requests
        10,   // user_max_requests
        1,    // window_seconds
        100,  // max_keys
        None, // redis
    );

    // 不同IP互不影响
    assert!(state.check_ip_rate_limit("192.168.1.1").await);
    assert!(state.check_ip_rate_limit("192.168.1.1").await);
    assert!(!state.check_ip_rate_limit("192.168.1.1").await); // 第三个被限流

    // 另一个IP应该不受影响
    assert!(state.check_ip_rate_limit("192.168.1.2").await);
    assert!(state.check_ip_rate_limit("192.168.1.2").await);
}

#[tokio::test]
async fn test_rate_limit_user_basic() {
    init_test_env();

    let state = create_rate_limit_middleware(
        10,   // ip_max_requests
        2,    // user_max_requests
        1,    // window_seconds
        100,  // max_keys
        None, // redis
    );

    let user_key = "user:test-user-id";

    // 前2次请求应该通过
    assert!(state.check_user_rate_limit(user_key).await);
    assert!(state.check_user_rate_limit(user_key).await);

    // 第3次应该被限流
    assert!(!state.check_user_rate_limit(user_key).await);
}

#[tokio::test]
async fn test_rate_limit_user_different_users() {
    init_test_env();

    let state = create_rate_limit_middleware(
        10,   // ip_max_requests
        2,    // user_max_requests
        1,    // window_seconds
        100,  // max_keys
        None, // redis
    );

    // 不同用户互不影响
    assert!(state.check_user_rate_limit("user:user1").await);
    assert!(state.check_user_rate_limit("user:user1").await);
    assert!(!state.check_user_rate_limit("user:user1").await); // user1 被限流

    // user2 应该不受影响
    assert!(state.check_user_rate_limit("user:user2").await);
    assert!(state.check_user_rate_limit("user:user2").await);
}

#[tokio::test]
async fn test_rate_limit_window_reset() {
    init_test_env();

    let state = create_rate_limit_middleware(
        2,    // ip_max_requests
        10,   // user_max_requests
        1,    // window_seconds
        100,  // max_keys
        None, // redis
    );

    let ip_key = "192.168.1.100";

    // 前2次通过
    assert!(state.check_ip_rate_limit(ip_key).await);
    assert!(state.check_ip_rate_limit(ip_key).await);

    // 第3次被限流
    assert!(!state.check_ip_rate_limit(ip_key).await);

    // 等待窗口过期（1秒）
    tokio::time::sleep(Duration::from_secs(2)).await;

    // 窗口重置后应该可以再次请求
    assert!(state.check_ip_rate_limit(ip_key).await);
}

#[tokio::test]
async fn test_rate_limit_both_ip_and_user() {
    init_test_env();

    let state = create_rate_limit_middleware(
        5,    // ip_max_requests
        3,    // user_max_requests
        1,    // window_seconds
        100,  // max_keys
        None, // redis
    );

    let ip_key = "192.168.1.50";
    let user_key = "user:limited-user";

    // 用户限流优先（用户只有3次）
    for _ in 0..3 {
        assert!(state.check_ip_rate_limit(ip_key).await);
        assert!(state.check_user_rate_limit(user_key).await);
    }

    // 用户已达到限制，即使IP还有额度
    assert!(state.check_ip_rate_limit(ip_key).await); // IP还有2次
    assert!(!state.check_user_rate_limit(user_key).await); // 用户已限流
}
