//! # 应用状态模块
//!
//! 统一管理应用的共享状态，包括配置、数据库连接池、存储后端和缓存服务。
//!
//! 使用 `State<AppState>` 替代多个 `Extension` 注入，
//! 符合 Axum 0.7 最佳实践。

use std::sync::Arc;

use sqlx::PgPool;

use crate::config::Config;
use crate::repositories::{DynFilesRepo, DynUsersRepo, SqlxFilesRepo, SqlxUsersRepo};
use crate::services::cache::CacheService;
use crate::services::file::FileService;
use crate::services::storage::StorageBackend;

/// 应用共享状态
///
/// 包含所有 handlers 和 services 需要的共享依赖：
/// - `config`: 应用配置（JWT、存储、文件限制等）
/// - `pool`: PostgreSQL 数据库连接池
/// - `storage`: 文件存储后端（本地或 S3）
/// - `cache`: 内存缓存服务
/// - `file_service`: 文件服务（统一注入，handlers 直接使用）
///
/// # 使用示例
///
/// ```rust,ignore
/// async fn my_handler(
///     State(state): State<AppState>,
/// ) -> Result<Response, AppError> {
///     state.file_service.some_method(...).await
/// }
/// ```
#[derive(Clone)]
pub struct AppState {
    /// 应用配置
    pub config: Arc<Config>,
    /// 数据库连接池
    pub pool: PgPool,
    /// 存储后端（本地文件系统或 S3）
    pub storage: Arc<dyn StorageBackend>,
    /// 内存缓存服务
    pub cache: CacheService,
    /// 文件服务（统一构造并注入，避免各 handler 内重复 from_state）
    pub file_service: Arc<FileService>,
}

impl AppState {
    /// 创建新的应用状态
    ///
    /// # 参数
    /// - `config`: 应用配置
    /// - `pool`: 数据库连接池
    /// - `storage`: 存储后端
    pub fn new(config: Arc<Config>, pool: PgPool, storage: Arc<dyn StorageBackend>) -> Self {
        let files_repo: DynFilesRepo = Arc::new(SqlxFilesRepo::new(pool.clone()));
        let users_repo: DynUsersRepo = Arc::new(SqlxUsersRepo::new(pool.clone()));
        let file_service = Arc::new(FileService::new(
            files_repo,
            users_repo,
            pool.clone(),
            storage.clone(),
            config.clone(),
        ));

        Self {
            config,
            pool,
            storage,
            cache: CacheService::new(),
            file_service,
        }
    }
}
