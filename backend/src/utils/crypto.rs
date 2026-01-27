//! # 加密工具模块
//!
//! 提供密码哈希和验证的统一接口，避免各服务重复实现。
//!
//! ## 使用示例
//!
//! ```rust,ignore
//! use crate::utils::crypto::{hash_password, verify_password};
//!
//! let hash = hash_password("my_password")?;
//! let is_valid = verify_password("my_password", &hash)?;
//! ```

use bcrypt::{hash, verify, DEFAULT_COST};

use crate::utils::AppError;

/// 哈希密码
///
/// 使用 bcrypt 算法对密码进行哈希处理。
///
/// # 参数
/// - `password`: 明文密码
///
/// # 返回
/// - `Ok(String)`: 哈希后的密码
/// - `Err(AppError::Internal)`: 哈希失败
///
/// # 示例
/// ```rust,ignore
/// let hash = hash_password("secure_password")?;
/// ```
pub fn hash_password(password: &str) -> Result<String, AppError> {
    hash(password, DEFAULT_COST).map_err(|e| {
        tracing::error!("Failed to hash password: {}", e);
        AppError::Internal
    })
}

/// 验证密码
///
/// 验证明文密码是否与哈希值匹配。
///
/// # 参数
/// - `password`: 明文密码
/// - `hash`: bcrypt 哈希值
///
/// # 返回
/// - `Ok(true)`: 密码匹配
/// - `Ok(false)`: 密码不匹配
/// - `Err(AppError)`: 验证过程出错
///
/// # 示例
/// ```rust,ignore
/// if verify_password("user_input", &stored_hash)? {
///     // 密码正确
/// }
/// ```
pub fn verify_password(password: &str, hash: &str) -> Result<bool, AppError> {
    verify(password, hash).map_err(|e| {
        tracing::error!("Failed to verify password: {}", e);
        AppError::Internal
    })
}

/// 生成随机令牌
///
/// 生成指定长度的随机字符串，用于分享链接、API Token 等。
///
/// # 参数
/// - `length`: 令牌长度
///
/// # 返回
/// 随机字符串
///
/// # 示例
/// ```rust,ignore
/// let token = generate_random_token(32); // 生成 32 字符的令牌
/// ```
pub fn generate_random_token(length: usize) -> String {
    use rand::Rng;

    const CHARSET: &[u8] = b"abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let mut rng = rand::thread_rng();

    (0..length)
        .map(|_| {
            let idx = rng.gen_range(0..CHARSET.len());
            CHARSET[idx] as char
        })
        .collect()
}
