//! # Handlers Module
//!
//! HTTP 请求处理器，负责处理来自客户端的请求并返回响应。
//!
//! ## 架构
//!
//! Handlers 遵循以下原则：
//! 1. **薄层设计**: Handlers 只负责 HTTP 相关逻辑（请求解析、响应构建）
//! 2. **业务逻辑分离**: 所有业务逻辑都在 `services/` 模块中
//! 3. **统一认证**: 使用 `extractors::AuthenticatedUser` 自动处理认证
//! 4. **统一响应**: 使用 `utils::response` 中的辅助函数构建响应
//!
//! ## 模块
//!
//! - `auth`: 用户认证相关（注册、登录、修改密码）
//! - `files`: 文件管理相关（上传、下载、删除、列表）
//! - `share`: 文件分享相关（创建分享、访问分享）
//! - `api_token`: API Token 管理相关

pub mod api_token;
pub mod auth;
pub mod files;
pub mod share;
