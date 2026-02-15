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

use std::collections::HashMap;
use std::sync::Arc;

use async_trait::async_trait;
use chrono::{DateTime, Utc};
use uuid::Uuid;

use crate::models::file::{File, FileListQuery, FileListResult, FileVersion};
use crate::models::user::User;
use crate::utils::AppError;

// ============================================================================
// 类型别名（Dyn 注入用）
// ============================================================================

/// 动态分发的 UsersRepository
pub type DynUsersRepo = Arc<dyn UsersRepository>;

/// 动态分发的 FilesRepository
pub type DynFilesRepo = Arc<dyn FilesRepository>;

/// 动态分发的 FileVersionsRepository
pub type DynFileVersionsRepo = Arc<dyn FileVersionsRepository>;

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

    /// 根据用户名查询用户。
    ///
    /// 目前登录统一走「邮箱 + 密码」或第三方登录，因此暂未暴露
    /// 「用户名登录」或「按用户名查重」的 API；未来如果需要支持
    /// 用户名登录/搜索，可以在 Repository 实现中补上该方法。
    #[allow(dead_code)]
    async fn find_by_username(&self, username: &str) -> Result<Option<User>, AppError>;

    /// 检查邮箱或用户名是否已存在
    async fn exists_by_email_or_username(
        &self,
        email: &str,
        username: &str,
    ) -> Result<bool, AppError>;

    /// 检查除指定用户外，是否有其他用户使用该邮箱或用户名
    async fn exists_by_email_or_username_excluding(
        &self,
        exclude_user_id: Uuid,
        email: &str,
        username: &str,
    ) -> Result<bool, AppError>;

    /// 更新用户资料（用户名、邮箱）
    async fn update_profile(
        &self,
        user_id: Uuid,
        username: &str,
        email: &str,
        updated_at: DateTime<Utc>,
    ) -> Result<(), AppError>;

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
    #[allow(clippy::too_many_arguments)]
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
        content_sha256: Option<&str>,
        folder_id: Option<Uuid>,
    ) -> Result<File, AppError>;

    /// 按内容哈希与大小查找任意一条记录（用于秒传复用存储）
    async fn find_by_content_hash_and_size(
        &self,
        content_sha256: &str,
        file_size: u64,
    ) -> Result<Option<File>, AppError>;

    /// 统计引用同一 file_path 的记录数（删除时仅当为 0 才删物理文件）
    async fn count_by_file_path(&self, file_path: &str) -> Result<u64, AppError>;

    /// 批量统计多个 file_path 的引用数，一次查询减少 round-trip（用于 batch_delete 等）
    async fn count_by_file_paths(&self, paths: &[String])
        -> Result<HashMap<String, u64>, AppError>;

    /// 根据 ID 和用户 ID 查询文件
    async fn find_by_id(&self, file_id: Uuid, user_id: Uuid) -> Result<Option<File>, AppError>;

    /// 检查文件是否属于指定用户
    async fn belongs_to_user(&self, file_id: Uuid, user_id: Uuid) -> Result<bool, AppError>;

    /// 查找同名文件（用于版本管理：检测是否已有同名文件）
    async fn find_by_name_and_folder(
        &self,
        user_id: Uuid,
        original_filename: &str,
        folder_id: Option<Uuid>,
    ) -> Result<Option<File>, AppError>;

    /// 列出指定文件夹下的文件。
    ///
    /// 当前文件列表接口基于统一的分页查询与过滤条件，
    /// 尚未提供「指定 folder_id 列表全部文件」的简单接口；
    /// 预留给将来做「文件夹视图」或后台管理时使用。
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
    async fn list(&self, user_id: Uuid, query: FileListQuery) -> Result<FileListResult, AppError>;
}

// ============================================================================
// FileVersionsRepository Trait
// ============================================================================

/// 文件版本数据访问接口
#[async_trait]
pub trait FileVersionsRepository: Send + Sync {
    /// 创建文件版本（将当前文件保存为历史版本）
    #[allow(clippy::too_many_arguments)]
    async fn create_version(
        &self,
        file_id: Uuid,
        user_id: Uuid,
        version_number: i32,
        filename: &str,
        original_filename: &str,
        file_path: &str,
        file_size: u64,
        mime_type: &str,
        storage_backend: &str,
        content_sha256: Option<&str>,
    ) -> Result<FileVersion, AppError>;

    /// 获取文件的所有版本列表（按版本号降序）
    async fn list_versions(
        &self,
        file_id: Uuid,
        user_id: Uuid,
    ) -> Result<Vec<FileVersion>, AppError>;

    /// 获取指定版本
    async fn get_version(
        &self,
        version_id: Uuid,
        user_id: Uuid,
    ) -> Result<Option<FileVersion>, AppError>;

    /// 获取文件的最大版本号
    async fn get_max_version_number(&self, file_id: Uuid) -> Result<i32, AppError>;

    /// 更新版本标签
    async fn update_label(
        &self,
        version_id: Uuid,
        user_id: Uuid,
        label: Option<&str>,
    ) -> Result<(), AppError>;

    /// 删除指定版本（同时删除物理文件）
    async fn delete_version(&self, version_id: Uuid, user_id: Uuid) -> Result<String, AppError>;

    /// 删除文件的所有旧版本（保留最近 N 个版本）
    async fn cleanup_old_versions(
        &self,
        file_id: Uuid,
        keep_count: i32,
    ) -> Result<Vec<String>, AppError>;
}
