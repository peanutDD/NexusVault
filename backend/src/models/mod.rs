//! # 数据模型模块（兼容层）
//!
//! ⚠️ **已废弃**：请使用 [`crate::entities`]（DB 实体）和 [`crate::types`]（API DTO）
//!
//! 本模块作为**兼容转发层**，所有 item 均从 `entities/` 和 `types/` 重新导出。
//! 现有代码中的 `use models::...` import 保持兼容，无需修改。
//!
//! ## 迁移状态
//!
//! | 原位置 | 新位置 | 状态 |
//! |--------|--------|------|
//! | `models::User` | `entities::user::User` | ✅ 已迁移 |
//! | `models::File` | `entities::file::File` | ✅ 已迁移 |
//! | `models::FileVersion` | `entities::file::FileVersion` | ✅ 已迁移 |
//! | `models::Folder` | `entities::folder::Folder` | ✅ 已迁移 |
//! | `models::FileShare` | `entities::share::FileShare` | ✅ 已迁移 |
//! | `models::ApiToken` | `entities::api_token::ApiToken` | ✅ 已迁移 |
//! | `models::UploadSession` | `entities::upload_session::UploadSession` | ✅ 已迁移 |
//! | `models::Organization*` | `entities::organization::*` | ✅ 已迁移 |
//! | `models::UserResponse` | `types::user::UserResponse` | ✅ 已迁移 |
//! | `models::FileListQuery` | `types::file::FileListQuery` | ✅ 已迁移 |
//! | `models::FileResponse` | `types::file::FileResponse` | ✅ 已迁移 |
//! | 其余 DTO | `types::` | ✅ 已迁移 |

pub mod api_token;
pub mod file;
pub mod folder;
pub mod organization;
pub mod share;
pub mod upload_session;
pub mod user;
