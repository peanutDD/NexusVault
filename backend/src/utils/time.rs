//! # 时间工具模块
//!
//! 提供时间相关的工具函数，包括过期时间计算、JWT 过期时间解析等。
//!
//! ## 使用示例
//!
//! ```rust,ignore
//! use crate::utils::time::{calculate_expiration, parse_jwt_expiry};
//!
//! let expires_at = calculate_expiration(Some(7)); // 7 天后过期
//! let exp = parse_jwt_expiry("24h"); // 24 小时后的 Unix 时间戳
//! ```

use chrono::{DateTime, Duration, Utc};

/// 计算过期时间
///
/// 根据天数计算从当前时间开始的过期时间。
///
/// # 参数
/// - `days`: 过期天数（None 表示永不过期）
///
/// # 返回
/// - `Some(DateTime<Utc>)`: 过期时间
/// - `None`: 永不过期
///
/// # 示例
/// ```rust,ignore
/// let expires_at = calculate_expiration(Some(7)); // 7 天后过期
/// let never_expires = calculate_expiration(None); // 永不过期
/// ```
pub fn calculate_expiration<T: Into<i64>>(days: Option<T>) -> Option<DateTime<Utc>> {
    days.map(|d| Utc::now() + Duration::days(d.into()))
}

/// 解析 JWT 过期时间配置
///
/// 将配置字符串（如 "24h", "7d"）解析为 Unix 时间戳。
///
/// # 参数
/// - `expiry_str`: 过期时间字符串
///   - 支持格式: "24h"（小时）, "7d"（天）
///   - 默认: 24 小时
///
/// # 返回
/// Unix 时间戳（秒）
///
/// # 示例
/// ```rust,ignore
/// let exp = parse_jwt_expiry("24h"); // 24 小时后
/// let exp = parse_jwt_expiry("7d");  // 7 天后
/// ```
pub fn parse_jwt_expiry(expiry_str: &str) -> usize {
    let now = Utc::now().timestamp() as usize;

    if expiry_str.ends_with('h') {
        let hours: usize = expiry_str
            .trim_end_matches('h')
            .parse()
            .unwrap_or(24);
        now + hours * 3600
    } else if expiry_str.ends_with('d') {
        let days: usize = expiry_str
            .trim_end_matches('d')
            .parse()
            .unwrap_or(1);
        now + days * 86400
    } else {
        // 默认 24 小时
        now + 86400
    }
}

/// 获取当前 Unix 时间戳
///
/// 返回当前时间的 Unix 时间戳（秒）。
///
/// # 返回
/// Unix 时间戳
pub fn now_timestamp() -> usize {
    Utc::now().timestamp() as usize
}
