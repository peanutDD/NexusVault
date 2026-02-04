//! Repository 抽象 Trait 定义
//!
//! ## 设计目标
//!
//! 1. **依赖倒置**：Service 依赖抽象 Trait，不依赖具体 SQLx 实现
//! 2. **可测试性**：测试时可用内存实现替换真实数据库
//! 3. **解耦演进**：切换数据库或 ORM 只需替换实现，不动 Service 逻辑
//!
//! ## 使用示例
//!
//! ```rust,ignore
//! // 生产环境：用 SQLx 实现
//! let users_repo: DynUsersRepo = Arc::new(SqlxUsersRepo::new(pool.clone()));
//!
//! // 测试环境：用内存实现
//! let users_repo: DynUsersRepo = Arc::new(InMemoryUsersRepo::new());
//!
//! // Service 只依赖 Trait
//! let auth_service = AuthService::new(users_repo, config);
//! ```

use std::sync::Arc;

use async_trait::async_trait;
use chrono::{DateTime, Utc};
use uuid::Uuid;

use crate::models::file::{File, FileListQuery};
use crate::models::user::User;
use crate::utils::AppError;

// ============================================================================
// 类型别名（Dyn 注入用）
// ============================================================================

/// 动态分发的 UsersRepository
pub type DynUsersRepo = Arc<dyn UsersRepository>;

/// 动态分发的 FilesRepository
pub type DynFilesRepo = Arc<dyn FilesRepository>;

// ============================================================================
// UsersRepository Trait
// ============================================================================

/// 用户数据访问接口
#[async_trait]
pub trait UsersRepository: Send + Sync {
    /// 根据 ID 查询用户
    async fn find_by_id(&self, user_id: Uuid) -> Result<Option<User>, AppError>;

    /// 根据邮箱查询用户
    async fn find_by_email(&self, email: &str) -> Result<Option<User>, AppError>;

    /// 根据用户名查询用户
    #[allow(dead_code)]
    async fn find_by_username(&self, username: &str) -> Result<Option<User>, AppError>;

    /// 检查邮箱或用户名是否已存在
    async fn exists_by_email_or_username(
        &self,
        email: &str,
        username: &str,
    ) -> Result<bool, AppError>;

    /// 获取用户存储配额
    async fn get_storage_quota(&self, user_id: Uuid) -> Result<Option<i64>, AppError>;

    /// 创建新用户
    async fn create(
        &self,
        username: &str,
        email: &str,
        password_hash: &str,
    ) -> Result<User, AppError>;

    /// 更新用户密码
    async fn update_password(
        &self,
        user_id: Uuid,
        password_hash: &str,
        updated_at: DateTime<Utc>,
    ) -> Result<(), AppError>;
}

// ============================================================================
// FilesRepository Trait
// ============================================================================

/// 文件数据访问接口
#[async_trait]
pub trait FilesRepository: Send + Sync {
    /// 插入新文件记录
    async fn insert(
        &self,
        file_id: Uuid,
        user_id: Uuid,
        storage_filename: &str,
        original_filename: &str,
        file_path: &str,
        file_size: u64,
        mime_type: &str,
        storage_backend: &str,
    ) -> Result<File, AppError>;

    /// 根据 ID 和用户 ID 查询文件
    async fn find_by_id(&self, file_id: Uuid, user_id: Uuid) -> Result<Option<File>, AppError>;

    /// 检查文件是否属于指定用户
    async fn belongs_to_user(&self, file_id: Uuid, user_id: Uuid) -> Result<bool, AppError>;

    /// 列出指定文件夹下的文件
    #[allow(dead_code)]
    async fn list_by_folder(
        &self,
        user_id: Uuid,
        folder_id: Option<Uuid>,
    ) -> Result<Vec<File>, AppError>;

    /// 删除单个文件记录
    async fn delete(&self, file_id: Uuid, user_id: Uuid) -> Result<u64, AppError>;

    /// 批量删除文件记录
    async fn delete_batch(&self, ids: &[Uuid], user_id: Uuid) -> Result<u64, AppError>;

    /// 获取用户存储使用量 (total_bytes, file_count)
    async fn get_storage_usage(&self, user_id: Uuid) -> Result<(i64, u64), AppError>;

    /// 列出用户的所有分类
    async fn list_categories(&self, user_id: Uuid) -> Result<Vec<String>, AppError>;

    /// 批量更新文件分类
    async fn update_category(
        &self,
        user_id: Uuid,
        ids: &[Uuid],
        category: Option<&str>,
        updated_at: DateTime<Utc>,
    ) -> Result<u64, AppError>;

    /// 统计指定文件的数量和总大小
    async fn sum_size_for_ids(&self, user_id: Uuid, ids: &[Uuid]) -> Result<(i64, i64), AppError>;

    /// 批量获取文件
    async fn find_by_ids(&self, user_id: Uuid, ids: &[Uuid]) -> Result<Vec<File>, AppError>;

    /// 批量获取文件路径
    async fn find_paths_by_ids(
        &self,
        user_id: Uuid,
        ids: &[Uuid],
    ) -> Result<Vec<(Uuid, String)>, AppError>;

    /// 分页查询文件列表
    async fn list(&self, user_id: Uuid, query: FileListQuery) -> Result<(Vec<File>, i64), AppError>;
}
