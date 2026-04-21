//! 数据库实体（与数据库表一一对应）
//!
//! ## 设计原则
//!
//! 1. **只给 repositories 用**：Service 层和 Handler 层不应直接依赖这些结构
//! 2. **无业务逻辑**：仅包含字段和 `FromRow` derive
//! 3. **禁止 API 序列化**：不用 `#[serde]`（由 `types/` 的 DTO 控制序列化）

pub mod file;
pub mod folder;
pub mod organization;
pub mod share;
pub mod api_token;
pub mod upload_session;
pub mod user;