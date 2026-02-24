//! # Extractors Module
//!
//! 提供统一的 Axum extractors，用于从请求中提取常用数据。
//!
//! 这个模块包含：
//! - `AuthenticatedUser`: 从请求头中提取并验证用户身份
//! - 其他可复用的提取器

pub mod admin;
pub mod auth;

pub use admin::AdminToken;
pub use auth::{AuthenticatedUser, AuthenticatedUserQuery};
