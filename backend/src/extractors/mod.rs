//! # Extractors Module
//!
//! 提供统一的 Axum extractors，用于从请求中提取常用数据。
//!
//! 这个模块包含：
//! - `AuthenticatedUser`: 从请求头中提取并验证用户身份
//! - 其他可复用的提取器

pub mod auth;
pub mod admin;

pub use auth::{AuthenticatedUser, AuthenticatedUserQuery};
pub use admin::AdminToken;
