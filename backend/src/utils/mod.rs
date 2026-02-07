//! # Utilities Module
//!
//! 提供通用的工具函数和类型定义。
//!
//! ## 子模块
//!
//! - `error`: 统一错误类型 `AppError`
//! - `response`: HTTP 响应构建工具
//! - `validation`: 输入验证工具
//! - `crypto`: 加密和哈希工具
//! - `time`: 时间处理工具
//! - `parse`: 参数解析工具

pub mod crypto;
pub mod error;
pub mod parse;
pub mod response;
pub mod thumbnail;
pub mod time;
pub mod validation;

// Error
pub use error::AppError;

// Crypto
pub use crypto::{generate_random_token, hash_password, verify_password};

// Time
pub use time::{calculate_expiration, now_timestamp, parse_jwt_expiry};

// Parse
pub use parse::{parse_part_number, parse_uuid_list};

// Response
pub use response::{file_response, json_response, stream_file_response, success_response};

// Validation
pub use validation::{validate_file_size, validate_mime_type};
