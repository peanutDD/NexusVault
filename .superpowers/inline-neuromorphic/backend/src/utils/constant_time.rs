//! # 常量时间比较工具
//!
//! 提供防止时序攻击的常量时间比较函数。
//!
//! ## 使用示例
//!
//! ```rust
//! use file_storage_backend::utils::constant_time::verify;
//!
//! let is_valid = verify(b"password123", b"password123");
//! assert!(is_valid);
//! ```

use subtle::ConstantTimeEq;

/// 常量时间比较两个字节切片
///
/// 防止时序攻击，确保比较时间与输入内容无关。
///
/// # 参数
/// - `a`: 第一个字节切片
/// - `b`: 第二个字节切片
///
/// # 返回
/// - `true`: 两个切片相等
/// - `false`: 两个切片不相等
pub fn verify(a: &[u8], b: &[u8]) -> bool {
    a.ct_eq(b).into()
}

/// 常量时间比较两个字符串
///
/// 防止时序攻击，确保比较时间与输入内容无关。
///
/// # 参数
/// - `a`: 第一个字符串
/// - `b`: 第二个字符串
///
/// # 返回
/// - `true`: 两个字符串相等
/// - `false`: 两个字符串不相等
pub fn verify_str(a: &str, b: &str) -> bool {
    a.as_bytes().ct_eq(b.as_bytes()).into()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_verify_equal() {
        assert!(verify(b"test", b"test"));
        assert!(verify(b"", b""));
        assert!(verify(b"\x00\x01\x02", b"\x00\x01\x02"));
    }

    #[test]
    fn test_verify_not_equal() {
        assert!(!verify(b"test", b"Test"));
        assert!(!verify(b"test", b"testing"));
        assert!(!verify(b"test", b""));
        assert!(!verify(b"", b"test"));
    }

    #[test]
    fn test_verify_str_equal() {
        assert!(verify_str("test", "test"));
        assert!(verify_str("", ""));
    }

    #[test]
    fn test_verify_str_not_equal() {
        assert!(!verify_str("test", "Test"));
        assert!(!verify_str("test", "testing"));
    }
}
