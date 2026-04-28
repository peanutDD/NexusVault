//! API 请求/响应 DTO（由 Handler 序列化，直接暴露给客户端）
//!
//! ## 设计原则
//!
//! 1. **只给 handlers 用**：Repository 层不感知这些类型
//! 2. **完整 serde**：使用 `#[serde]` 控制序列化行为（如 `skip_serializing`）
//! 3. **验证集成**：请求 DTO 可带 `#[derive(validator::Validate)]`

pub mod api_token;
pub mod file;
pub mod folder;
pub mod organization;
pub mod share;
pub mod upload_session;
pub mod user;
