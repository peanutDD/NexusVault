//! # 解析工具模块
//!
//! 提供通用的解析工具函数，用于处理请求参数。
//!
//! ## 使用示例
//!
//! ```rust,ignore
//! use crate::utils::parse::{parse_uuid_list, parse_part_number};
//!
//! let ids = parse_uuid_list("uuid1,uuid2,uuid3")?;
//! let part = parse_part_number(&params)?;
//! ```

use std::collections::HashMap;
use std::str::FromStr;
use uuid::Uuid;

use crate::utils::AppError;

/// 解析逗号分隔的 UUID 列表
///
/// 将逗号分隔的 UUID 字符串解析为 UUID 向量。
///
/// # 参数
/// - `ids_str`: 逗号分隔的 UUID 字符串
///
/// # 返回
/// - `Ok(Vec<Uuid>)`: 解析成功的 UUID 列表
/// - `Err(AppError::Validation)`: UUID 格式无效
///
/// # 示例
/// ```rust,ignore
/// let ids = parse_uuid_list("550e8400-e29b-41d4-a716-446655440000,uuid2")?;
/// ```
pub fn parse_uuid_list(ids_str: &str) -> Result<Vec<Uuid>, AppError> {
    ids_str
        .split(',')
        .map(|s| {
            Uuid::from_str(s.trim())
                .map_err(|_| AppError::Validation(format!("Invalid UUID format: {}", s)))
        })
        .collect()
}

/// 从查询参数中解析分块编号
///
/// 用于分块上传时解析 `part` 查询参数。
///
/// # 参数
/// - `params`: 查询参数 HashMap
///
/// # 返回
/// - `Ok(u32)`: 分块编号（从 1 开始）
/// - `Err(AppError::Validation)`: 参数缺失或格式无效
///
/// # 示例
/// ```rust,ignore
/// let part = parse_part_number(&query_params)?;
/// ```
pub fn parse_part_number(params: &HashMap<String, String>) -> Result<u32, AppError> {
    params
        .get("part")
        .and_then(|s| s.parse::<u32>().ok())
        .ok_or_else(|| {
            AppError::Validation("Missing or invalid 'part' query parameter".to_string())
        })
}

/// 解析可选的整数参数
///
/// 从字符串解析可选的整数值。
///
/// # 参数
/// - `value`: 可选的字符串值
///
/// # 返回
/// - `Some(i64)`: 解析成功
/// - `None`: 值为 None 或解析失败
pub fn parse_optional_i64(value: Option<&str>) -> Option<i64> {
    value.and_then(|s| s.parse::<i64>().ok())
}

/// 解析可选的 UUID
///
/// 从字符串解析可选的 UUID。
///
/// # 参数
/// - `value`: 可选的字符串值
///
/// # 返回
/// - `Some(Uuid)`: 解析成功
/// - `None`: 值为 None 或格式无效
pub fn parse_optional_uuid(value: Option<&str>) -> Option<Uuid> {
    value.and_then(|s| Uuid::from_str(s).ok())
}
