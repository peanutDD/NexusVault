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

use std::io::Read;
use std::path::Path;

use bcrypt::{hash, verify, DEFAULT_COST};
use sha2::{Digest, Sha256};

use crate::utils::AppError;

/// 计算字节的 SHA-256 并返回十六进制字符串（64 字符）
pub fn sha256_hex(data: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(data);
    format!("{:x}", hasher.finalize())
}

/// 计算文件的 SHA-256（十六进制），适用于阻塞上下文或 spawn_blocking
pub fn sha256_file_hex(path: &Path) -> Result<String, AppError> {
    let mut f = std::fs::File::open(path)
        .map_err(|e| AppError::File(format!("Failed to open file for hashing: {}", e)))?;
    let mut hasher = Sha256::new();
    let mut buf = [0u8; 8192];
    loop {
        let n = f
            .read(&mut buf)
            .map_err(|e| AppError::File(format!("Failed to read file for hashing: {}", e)))?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
    }
    Ok(format!("{:x}", hasher.finalize()))
}

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
    use crate::constants::RANDOM_TOKEN_CHARSET;
    use rand::Rng;

    let mut rng = rand::rng();

    (0..length)
        .map(|_| {
            let idx = rng.random_range(0..RANDOM_TOKEN_CHARSET.len());
            RANDOM_TOKEN_CHARSET[idx] as char
        })
        .collect()
}
