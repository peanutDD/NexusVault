//! 兼容转发层
//!
//! - DB 实体 → [`crate::entities::upload_session`] ✅ 已迁移
//! - API DTO → [`crate::types::upload_session`] ✅ 已迁移

pub use crate::entities::upload_session::UploadSession;

pub use crate::types::upload_session::{
    ChunkedUploadStatusResponse, CompleteChunkedUploadRequest, InitChunkedUploadRequest,
    InitChunkedUploadResponse,
};
