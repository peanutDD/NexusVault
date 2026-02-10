//! # 文件服务模块
//!
//! 提供文件管理的核心业务逻辑，包括：
//!
//! - **文件上传**: 普通上传和分块上传
//! - **文件查询**: 列表、搜索、过滤
//! - **文件操作**: 下载、预览、删除
//! - **批量操作**: 批量删除、批量移动、批量下载
//! - **存储配额**: 配额检查和使用量统计
//!
//! ## 设计目标
//!
//! 1. **依赖倒置**：通过 `DynFilesRepo` / `DynUsersRepo` 依赖抽象
//! 2. **可测试性**：测试时可用内存实现替换真实数据库
//! 3. **模块化**：按业务能力拆分为子模块，降低复杂度

mod batch_get;
mod batch_zip;
pub(crate) use batch_zip::run_zip_writer_thread;
mod categories;
mod chunked_upload;
mod delete;
mod instant_upload;
mod video;
mod hls;
mod list;
mod quota;
mod read;
mod storage_factory;
mod upload;

use std::path::Path;
use std::sync::Arc;

use sqlx::PgPool;
use uuid::Uuid;

use crate::config::Config;
use crate::repositories::{DynFilesRepo, DynUsersRepo, SqlxFilesRepo, SqlxUsersRepo};
use crate::services::storage::StorageBackend;
use crate::utils::AppError;

pub use storage_factory::create_storage;

/// 文件服务
///
/// 通过 `DynFilesRepo` / `DynUsersRepo` 依赖抽象，而非具体的 SQLx 实现。
pub struct FileService {
    /// 文件仓库（Trait Object）
    pub(super) files_repo: DynFilesRepo,
    /// 用户仓库（Trait Object），用于配额查询
    pub(super) users_repo: DynUsersRepo,
    /// 数据库连接池（仅用于分块上传会话等尚未抽象的 Repository）
    pub(super) pool: PgPool,
    /// 存储后端
    pub(super) storage: Arc<dyn StorageBackend>,
    /// 应用配置
    pub(super) config: Arc<Config>,
}

impl FileService {
    /// 创建新的 FileService 实例
    ///
    /// # 参数
    /// - `files_repo`: 文件仓库（Trait Object）
    /// - `users_repo`: 用户仓库（Trait Object）
    /// - `pool`: 数据库连接池（用于尚未抽象的 Repository）
    /// - `storage`: 存储后端
    /// - `config`: 应用配置
    pub fn new(
        files_repo: DynFilesRepo,
        users_repo: DynUsersRepo,
        pool: PgPool,
        storage: Arc<dyn StorageBackend>,
        config: Arc<Config>,
    ) -> Self {
        Self {
            files_repo,
            users_repo,
            pool,
            storage,
            config,
        }
    }

    /// 从 AppState 创建 FileService（工厂方法）
    ///
    /// 使用 SQLx 实现的 Repository。
    pub fn from_state(state: &crate::AppState) -> Self {
        let files_repo: DynFilesRepo = Arc::new(SqlxFilesRepo::new(state.pool.clone()));
        let users_repo: DynUsersRepo = Arc::new(SqlxUsersRepo::new(state.pool.clone()));

        Self::new(
            files_repo,
            users_repo,
            state.pool.clone(),
            state.storage.clone(),
            state.config.clone(),
        )
    }

    /// 上传类操作的统一校验（详细配额错误信息）
    pub(super) async fn ensure_can_store_detailed(
        &self,
        user_id: Uuid,
        mime_type: &str,
        file_size: u64,
    ) -> Result<(), AppError> {
        crate::utils::validate_file_size(file_size, self.config.max_file_size)?;
        crate::utils::validate_mime_type(mime_type, &self.config.allowed_mime_types)?;

        let (current_usage, _) = self.get_storage_usage(user_id).await?;
        if let Some(quota) = self.get_storage_quota(user_id).await? {
            if current_usage + file_size as i64 > quota {
                return Err(AppError::Validation(format!(
                    "存储配额不足。已使用: {} MB, 配额: {} MB, 需要: {} MB",
                    (current_usage as f64 / 1_048_576.0).round() as i64,
                    (quota as f64 / 1_048_576.0).round() as i64,
                    (file_size as f64 / 1_048_576.0).round() as i64,
                )));
            }
        }
        Ok(())
    }

    /// 分块上传初始化的统一校验（短错误信息，避免把细节泄露给前端）
    pub(super) async fn ensure_can_store_quota_simple(
        &self,
        user_id: Uuid,
        mime_type: &str,
        file_size: u64,
    ) -> Result<(), AppError> {
        crate::utils::validate_file_size(file_size, self.config.max_file_size)?;
        crate::utils::validate_mime_type(mime_type, &self.config.allowed_mime_types)?;

        let (current_usage, _) = self.get_storage_usage(user_id).await?;
        if let Some(quota) = self.get_storage_quota(user_id).await? {
            if current_usage + file_size as i64 > quota {
                return Err(AppError::Validation("存储配额不足".to_string()));
            }
        }
        Ok(())
    }

    pub(super) fn chunked_temp_dir(&self, upload_id: Uuid) -> std::path::PathBuf {
        Path::new(&self.config.storage_path)
            .join(".chunked")
            .join(upload_id.to_string())
    }
}
