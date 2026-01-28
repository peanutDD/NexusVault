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
//! ## 设计目标（为什么要拆分）
//!
//! 旧的 `services/file.rs` 过大时，常见问题是：
//! - 不同功能（列表/上传/分块/批量）混在一起，改动风险高
//! - 重复的校验/查询/路径处理逻辑到处复制，难以统一优化
//! - 编译/审查成本高，不利于渐进式重构
//!
//! 因此这里按“业务能力”拆成多个子模块文件，并保持对外 `FileService` API 不变。

mod batch_zip;
mod categories;
mod chunked_upload;
mod delete;
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
use crate::services::storage::StorageBackend;
use crate::utils::AppError;

pub use storage_factory::create_storage;

/// 分块上传的块大小（5 MiB）
pub const CHUNK_SIZE: u32 = 5 * 1024 * 1024;

/// 批量下载 ZIP 的安全限制（硬限制）
///
/// 说明：当前实现会把每个文件内容与最终 ZIP 都放在内存里（Vec<u8>），
/// 若不限制，容易导致内存暴涨/超时/服务不稳定。
pub(super) const MAX_BATCH_ZIP_FILES: usize = 200;
pub(super) const MAX_BATCH_ZIP_TOTAL_BYTES: i64 = 250 * 1024 * 1024; // 250 MiB

pub struct FileService {
    pub(super) pool: PgPool,
    pub(super) storage: Arc<dyn StorageBackend>,
    pub(super) config: Arc<Config>,
}

impl FileService {
    /// 创建新的 FileService 实例
    pub fn new(pool: PgPool, storage: Arc<dyn StorageBackend>, config: Arc<Config>) -> Self {
        Self {
            pool,
            storage,
            config,
        }
    }

    /// 从 AppState 创建 FileService（工厂方法）
    ///
    /// 简化 handler 中的 Service 创建，避免重复的 clone 调用。
    pub fn from_state(state: &crate::AppState) -> Self {
        Self::new(
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
