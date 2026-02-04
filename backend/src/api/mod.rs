//! # API Module
//!
//! 路由定义模块，负责将 HTTP 请求路由到相应的处理器。
//!
//! ## 设计原则
//!
//! 1. **路由集中管理**: 所有路由定义都在此模块中
//! 2. **模块化路由**: 每个功能模块有独立的 `create_router()` 函数
//! 3. **清晰的路由结构**: 使用 RESTful 风格的路由命名

pub mod api_token;
pub mod auth;
pub mod files;
pub mod folders;
pub mod openapi;
pub mod share;
