//! # 数据访问层（Repository）
//!
//! ## 设计理念
//!
//! 1. **Trait 抽象**：每个业务领域定义一个 Repository Trait（如 `UsersRepository`、`FilesRepository`）
//! 2. **具体实现**：`SqlxXxxRepo` 提供 PostgreSQL/SQLx 实现
//! 3. **Dyn 注入**：Service 通过 `Arc<dyn XxxRepository>` 依赖抽象，便于测试和替换
//!
//! ## 模块列表
//!
//! - `traits`: Repository Trait 定义 + Dyn 类型别名
//! - `users`: 用户表操作（`SqlxUsersRepo`）
//! - `files`: 文件表操作（`SqlxFilesRepo`）
//! - `folders`: 文件夹表操作
//! - `shares`: 分享表操作
//! - `api_tokens`: API Token 表操作
//! - `upload_sessions`: 上传会话表操作
//!
//! ## 使用示例
//!
//! ```rust,ignore
//! use crate::repositories::{DynUsersRepo, DynFilesRepo, SqlxUsersRepo, SqlxFilesRepo};
//!
//! // 生产环境
//! let users_repo: DynUsersRepo = Arc::new(SqlxUsersRepo::new(pool.clone()));
//! let files_repo: DynFilesRepo = Arc::new(SqlxFilesRepo::new(pool.clone()));
//!
//! // 注入到 Service
//! let auth_service = AuthService::new(users_repo, config);
//! let file_service = FileService::new(files_repo, users_repo, storage, config);
//! ```

pub mod api_tokens;
pub mod files;
pub mod file_versions;
pub mod folders;
pub mod shares;
pub mod traits;
pub mod upload_sessions;
pub mod users;
pub mod organizations;

// ============================================================================
// 重新导出：Trait + Dyn 别名
// ============================================================================

pub use traits::{DynFilesRepo, DynFileVersionsRepo, DynUsersRepo};

// ============================================================================
// 重新导出：SQLx 具体实现
// ============================================================================

pub use files::SqlxFilesRepo;
pub use file_versions::SqlxFileVersionsRepo;
pub use users::SqlxUsersRepo;
pub use organizations::OrganizationsRepo;

// ============================================================================
// 重新导出：其他 Repository（暂未抽象为 Trait）
// ============================================================================

pub use api_tokens::ApiTokensRepo;
pub use folders::FoldersRepo;
pub use shares::SharesRepo;
#[allow(unused_imports)]
pub use upload_sessions::UploadSessionsRepo;
