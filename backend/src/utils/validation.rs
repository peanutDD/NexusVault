//! # 验证工具模块
//!
//! 提供通用的输入验证函数。
//!
//! ## 使用示例
//!
//! ```rust,ignore
//! use crate::utils::validation::{sanitize_filename, validate_file_size};
//!
//! let safe_name = sanitize_filename("../etc/passwd")?;
//! validate_file_size(1024, 1_000_000)?;
//! ```

use crate::utils::AppError;

/// 清理文件名
///
/// 移除路径组件和危险字符，防止路径遍历攻击。
///
/// # 参数
/// - `filename`: 原始文件名
///
/// # 返回
/// - `Ok(String)`: 安全的文件名
/// - `Err(AppError::Validation)`: 文件名无效
pub fn sanitize_filename(filename: &str) -> Result<String, AppError> {
    // Remove path components and dangerous characters
    let sanitized = filename
        .replace("..", "")
        .replace('/', "")
        .replace('\\', "")
        .replace('\0', "")
        .trim()
        .to_string();

    if sanitized.is_empty() {
        return Err(AppError::Validation("Invalid filename".to_string()));
    }

    Ok(sanitized)
}

/// 验证 MIME 类型
///
/// 检查文件类型是否在允许列表中。支持通配符（如 `image/*`）。
/// 特殊值 `*/*` 或 `*` 表示允许所有类型。
///
/// # 参数
/// - `mime_type`: 要验证的 MIME 类型
/// - `allowed_types`: 允许的类型列表
///
/// # 返回
/// - `Ok(())`: 类型允许
/// - `Err(AppError::Validation)`: 类型不允许
pub fn validate_mime_type(mime_type: &str, allowed_types: &[String]) -> Result<(), AppError> {
    // 空列表表示允许所有
    if allowed_types.is_empty() {
        return Ok(());
    }

    let mime_lower = mime_type.to_lowercase();

    for allowed in allowed_types {
        let allowed_lower = allowed.to_lowercase().trim().to_string();
        
        // 允许所有类型（使用 matches! 宏简化多值比较）
        if matches!(allowed_lower.as_str(), "*/*" | "*") {
            return Ok(());
        }
        
        // 通配符匹配（如 video/* 匹配 video/mp4）
        if allowed_lower.ends_with("/*") {
            let prefix = allowed_lower.trim_end_matches("/*");
            if mime_lower.starts_with(&format!("{}/", prefix)) {
                return Ok(());
            }
        } 
        // 精确匹配
        else if mime_lower == allowed_lower {
            return Ok(());
        }
    }

    Err(AppError::Validation(format!(
        "File type {} is not allowed",
        mime_type
    )))
}

/// 验证文件大小
///
/// 检查文件大小是否超过限制。
///
/// # 参数
/// - `size`: 文件大小（字节）
/// - `max_size`: 最大允许大小（字节）
///
/// # 返回
/// - `Ok(())`: 大小合法
/// - `Err(AppError::Validation)`: 超过限制
pub fn validate_file_size(size: u64, max_size: u64) -> Result<(), AppError> {
    if size > max_size {
        Err(AppError::PayloadTooLarge(format!(
            "文件大小 {} 字节超过最大限制 {} 字节",
            size, max_size
        )))
    } else {
        Ok(())
    }
}

/// 验证分页参数
///
/// 检查分页参数是否在合理范围内。
///
/// # 参数
/// - `page`: 页码
/// - `limit`: 每页数量
///
/// # 返回
/// - `Ok((page, limit))`: 规范化后的参数
/// - `Err(AppError::Validation)`: 参数无效
pub fn validate_pagination(page: Option<u32>, limit: Option<u32>) -> Result<(u32, u32), AppError> {
    let page = page.unwrap_or(1);
    let limit = limit.unwrap_or(20);

    if page == 0 {
        return Err(AppError::Validation("页码必须大于 0".to_string()));
    }

    if limit == 0 || limit > 100 {
        return Err(AppError::Validation(
            "每页数量必须在 1-100 之间".to_string(),
        ));
    }

    Ok((page, limit))
}

/// 验证搜索关键词
///
/// 检查搜索关键词长度。
///
/// # 参数
/// - `search`: 搜索关键词
///
/// # 返回
/// - `Ok(Option<String>)`: 规范化的关键词
/// - `Err(AppError::Validation)`: 关键词无效
pub fn validate_search(search: Option<&str>) -> Result<Option<String>, AppError> {
    match search {
        Some(s) if s.is_empty() => Ok(None),
        Some(s) if s.len() > 100 => Err(AppError::Validation(
            "搜索关键词不能超过 100 个字符".to_string(),
        )),
        Some(s) => Ok(Some(s.trim().to_string())),
        None => Ok(None),
    }
}
