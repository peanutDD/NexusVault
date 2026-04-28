//! 兼容转发层
//!
//! - DB 实体 → [`crate::entities::share`] ✅ 已迁移
//! - API DTO → [`crate::types::share`] ✅ 已迁移

pub use crate::entities::share::FileShare;

pub use crate::types::share::{
    AccessShareRequest, BatchShareRequest, BatchShareResponse, CreateShareRequest, ShareResponse,
};
