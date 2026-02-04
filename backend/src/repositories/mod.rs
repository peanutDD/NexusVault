//! # 数据访问层（Repository）
//!
//! 目标：把"SQL/事务/连接池细节"从 Service 中剥离出来，降低耦合、便于测试与演进。
//! Service 只负责业务编排（存储/校验/跨表流程），Repository 负责数据读写。
//!
//! ## 模块列表
//!
//! - `files`: 文件表操作
//! - `folders`: 文件夹表操作
//! - `shares`: 分享表操作
//! - `api_tokens`: API Token 表操作
//! - `upload_sessions`: 上传会话表操作
//! - `users`: 用户表操作

pub mod api_tokens;
pub mod files;
pub mod folders;
pub mod shares;
pub mod upload_sessions;
pub mod users;

// 重新导出常用类型
pub use api_tokens::ApiTokensRepo;
pub use files::FilesRepo;
pub use folders::FoldersRepo;
pub use shares::SharesRepo;
pub use upload_sessions::UploadSessionsRepo;
pub use users::UsersRepo;
