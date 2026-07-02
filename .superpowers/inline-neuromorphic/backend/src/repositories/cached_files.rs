//! # CachedFilesRepo - 文件仓库缓存装饰器
//!
//! 使用装饰器模式包装 FilesRepository，为 list 和 get_storage_usage 添加 Redis 缓存。
//! 写操作会自动触发缓存失效。

use std::collections::HashMap;
use std::sync::Arc;

use async_trait::async_trait;
use chrono::{DateTime, Utc};
use uuid::Uuid;

use crate::models::file::{File, FileListQuery, FileListResult};
use crate::repositories::traits::{DynFilesRepo, FilesRepository};
use crate::services::cache::files::FileCacheService;
use crate::utils::AppError;

/// 带缓存的文件仓库装饰器
///
/// 包装 `DynFilesRepo`，在 list 和 get_storage_usage 方法上添加 Redis 缓存。
/// 写操作（insert/delete/rename/update_category）会自动调用 invalidate_user_cache。
#[derive(Clone)]
pub struct CachedFilesRepo {
    inner: DynFilesRepo,
    cache: Arc<FileCacheService>,
}

impl CachedFilesRepo {
    pub fn new(inner: DynFilesRepo, cache: Arc<FileCacheService>) -> Self {
        Self { inner, cache }
    }

    /// 调用缓存失效，记录错误但不传播（最终一致性）
    async fn invalidate_cache(&self, user_id: Uuid) {
        if let Err(e) = self.cache.invalidate_user_cache(user_id).await {
            tracing::error!(error = %e, user_id = %user_id, "Failed to invalidate user cache");
        }
    }
}

#[async_trait]
impl FilesRepository for CachedFilesRepo {
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
        review_status: &str,
    ) -> Result<File, AppError> {
        let result = self
            .inner
            .insert(
                file_id,
                user_id,
                storage_filename,
                original_filename,
                file_path,
                file_size,
                mime_type,
                storage_backend,
                content_sha256,
                folder_id,
                review_status,
            )
            .await?;

        // 写操作后失效缓存
        self.invalidate_cache(user_id).await;

        Ok(result)
    }

    async fn find_by_content_hash_and_size(
        &self,
        content_sha256: &str,
        file_size: u64,
    ) -> Result<Option<File>, AppError> {
        self.inner
            .find_by_content_hash_and_size(content_sha256, file_size)
            .await
    }

    async fn count_by_file_path(&self, file_path: &str) -> Result<u64, AppError> {
        self.inner.count_by_file_path(file_path).await
    }

    async fn count_by_file_paths(
        &self,
        paths: &[String],
    ) -> Result<HashMap<String, u64>, AppError> {
        self.inner.count_by_file_paths(paths).await
    }

    async fn find_by_id(&self, file_id: Uuid, user_id: Uuid) -> Result<Option<File>, AppError> {
        self.inner.find_by_id(file_id, user_id).await
    }

    async fn find_deleted_by_id(
        &self,
        file_id: Uuid,
        user_id: Uuid,
    ) -> Result<Option<File>, AppError> {
        self.inner.find_deleted_by_id(file_id, user_id).await
    }

    async fn belongs_to_user(&self, file_id: Uuid, user_id: Uuid) -> Result<bool, AppError> {
        self.inner.belongs_to_user(file_id, user_id).await
    }

    async fn find_by_name_and_folder(
        &self,
        user_id: Uuid,
        original_filename: &str,
        folder_id: Option<Uuid>,
    ) -> Result<Option<File>, AppError> {
        self.inner
            .find_by_name_and_folder(user_id, original_filename, folder_id)
            .await
    }

    async fn rename(
        &self,
        file_id: Uuid,
        user_id: Uuid,
        original_filename: &str,
    ) -> Result<File, AppError> {
        let result = self
            .inner
            .rename(file_id, user_id, original_filename)
            .await?;

        // 写操作后失效缓存
        self.invalidate_cache(user_id).await;

        Ok(result)
    }

    async fn list_by_folder(
        &self,
        user_id: Uuid,
        folder_id: Option<Uuid>,
    ) -> Result<Vec<File>, AppError> {
        self.inner.list_by_folder(user_id, folder_id).await
    }

    async fn delete(&self, file_id: Uuid, user_id: Uuid) -> Result<u64, AppError> {
        let result = self.inner.delete(file_id, user_id).await?;

        // 写操作后失效缓存
        self.invalidate_cache(user_id).await;

        Ok(result)
    }

    async fn soft_delete(&self, file_id: Uuid, user_id: Uuid) -> Result<u64, AppError> {
        let result = self.inner.soft_delete(file_id, user_id).await?;
        self.invalidate_cache(user_id).await;
        Ok(result)
    }

    async fn soft_delete_batch(&self, ids: &[Uuid], user_id: Uuid) -> Result<u64, AppError> {
        let result = self.inner.soft_delete_batch(ids, user_id).await?;
        self.invalidate_cache(user_id).await;
        Ok(result)
    }

    async fn restore_deleted(&self, file_id: Uuid, user_id: Uuid) -> Result<File, AppError> {
        let result = self.inner.restore_deleted(file_id, user_id).await?;
        self.invalidate_cache(user_id).await;
        Ok(result)
    }

    async fn list_deleted(&self, user_id: Uuid) -> Result<Vec<File>, AppError> {
        self.inner.list_deleted(user_id).await
    }

    async fn hard_delete_deleted(&self, file_id: Uuid, user_id: Uuid) -> Result<u64, AppError> {
        let result = self.inner.hard_delete_deleted(file_id, user_id).await?;
        self.invalidate_cache(user_id).await;
        Ok(result)
    }

    async fn hard_delete_deleted_batch(
        &self,
        ids: &[Uuid],
        user_id: Uuid,
    ) -> Result<Vec<File>, AppError> {
        let result = self.inner.hard_delete_deleted_batch(ids, user_id).await?;
        self.invalidate_cache(user_id).await;
        Ok(result)
    }

    async fn hard_delete_all_deleted(&self, user_id: Uuid) -> Result<Vec<File>, AppError> {
        let result = self.inner.hard_delete_all_deleted(user_id).await?;
        self.invalidate_cache(user_id).await;
        Ok(result)
    }

    async fn purge_expired_deleted(
        &self,
        retention_days: i64,
        batch_limit: i64,
    ) -> Result<Vec<File>, AppError> {
        self.inner
            .purge_expired_deleted(retention_days, batch_limit)
            .await
    }

    async fn delete_batch(&self, ids: &[Uuid], user_id: Uuid) -> Result<u64, AppError> {
        let result = self.inner.delete_batch(ids, user_id).await?;

        // 写操作后失效缓存
        self.invalidate_cache(user_id).await;

        Ok(result)
    }

    async fn get_storage_usage(&self, user_id: Uuid) -> Result<(i64, u64), AppError> {
        // 先尝试从缓存获取
        if let Some((total_size, file_count)) = self.cache.get_storage_usage(user_id).await? {
            tracing::debug!(user_id = %user_id, "Storage usage cache hit");
            return Ok((total_size, file_count));
        }

        // 缓存未命中，从数据库获取
        let (total_size, file_count) = self.inner.get_storage_usage(user_id).await?;

        // 回填缓存
        let _ = self
            .cache
            .set_storage_usage(user_id, total_size, file_count)
            .await;

        Ok((total_size, file_count))
    }

    async fn list_categories(&self, user_id: Uuid) -> Result<Vec<String>, AppError> {
        self.inner.list_categories(user_id).await
    }

    async fn update_category(
        &self,
        user_id: Uuid,
        ids: &[Uuid],
        category: Option<&str>,
        updated_at: DateTime<Utc>,
    ) -> Result<u64, AppError> {
        let result = self
            .inner
            .update_category(user_id, ids, category, updated_at)
            .await?;

        // 写操作后失效缓存
        self.invalidate_cache(user_id).await;

        Ok(result)
    }

    async fn sum_size_for_ids(&self, user_id: Uuid, ids: &[Uuid]) -> Result<(i64, i64), AppError> {
        self.inner.sum_size_for_ids(user_id, ids).await
    }

    async fn find_by_ids(&self, user_id: Uuid, ids: &[Uuid]) -> Result<Vec<File>, AppError> {
        self.inner.find_by_ids(user_id, ids).await
    }

    async fn find_paths_by_ids(
        &self,
        user_id: Uuid,
        ids: &[Uuid],
    ) -> Result<Vec<(Uuid, String)>, AppError> {
        self.inner.find_paths_by_ids(user_id, ids).await
    }

    async fn list(&self, user_id: Uuid, query: FileListQuery) -> Result<FileListResult, AppError> {
        // 先尝试从缓存获取
        if let Some(result) = self.cache.get_files_list(user_id, &query).await? {
            tracing::debug!(user_id = %user_id, "File list cache hit");
            return Ok(result);
        }

        // 缓存未命中，从数据库获取
        let result = self.inner.list(user_id, query.clone()).await?;

        // 回填缓存
        let _ = self.cache.set_files_list(user_id, &query, &result).await;

        Ok(result)
    }
}

// =============================================================================
// 测试
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::file::{File, FileListQuery, FileListResult};
    use std::collections::HashMap;

    /// Mock FilesRepository 实现（仅用于编译时 trait 验证）
    struct MockFilesRepo;

    #[async_trait]
    impl FilesRepository for MockFilesRepo {
        async fn insert(
            &self,
            _file_id: Uuid,
            _user_id: Uuid,
            _storage_filename: &str,
            _original_filename: &str,
            _file_path: &str,
            _file_size: u64,
            _mime_type: &str,
            _storage_backend: &str,
            _content_sha256: Option<&str>,
            _folder_id: Option<Uuid>,
            _review_status: &str,
        ) -> Result<File, AppError> {
            Ok(File {
                id: Uuid::new_v4(),
                user_id: Uuid::new_v4(),
                filename: "test.txt".to_string(),
                original_filename: "test.txt".to_string(),
                file_path: "/test.txt".to_string(),
                file_size: 100,
                mime_type: "text/plain".to_string(),
                storage_backend: "local".to_string(),
                category: None,
                folder_id: None,
                content_sha256: None,
                is_favorite: false,
                is_pinned: false,
                last_opened_at: None,
                review_status: "approved".to_string(),
                created_at: Utc::now(),
                updated_at: Utc::now(),
                deleted_at: None,
            })
        }

        async fn find_by_content_hash_and_size(
            &self,
            _content_sha256: &str,
            _file_size: u64,
        ) -> Result<Option<File>, AppError> {
            Ok(None)
        }

        async fn count_by_file_path(&self, _file_path: &str) -> Result<u64, AppError> {
            Ok(0)
        }

        async fn count_by_file_paths(
            &self,
            _paths: &[String],
        ) -> Result<HashMap<String, u64>, AppError> {
            Ok(HashMap::new())
        }

        async fn find_by_id(
            &self,
            _file_id: Uuid,
            _user_id: Uuid,
        ) -> Result<Option<File>, AppError> {
            Ok(None)
        }

        async fn find_deleted_by_id(
            &self,
            _file_id: Uuid,
            _user_id: Uuid,
        ) -> Result<Option<File>, AppError> {
            Ok(None)
        }

        async fn belongs_to_user(&self, _file_id: Uuid, _user_id: Uuid) -> Result<bool, AppError> {
            Ok(false)
        }

        async fn find_by_name_and_folder(
            &self,
            _user_id: Uuid,
            _original_filename: &str,
            _folder_id: Option<Uuid>,
        ) -> Result<Option<File>, AppError> {
            Ok(None)
        }

        async fn rename(
            &self,
            _file_id: Uuid,
            _user_id: Uuid,
            _original_filename: &str,
        ) -> Result<File, AppError> {
            Ok(File {
                id: Uuid::new_v4(),
                user_id: Uuid::new_v4(),
                filename: "renamed.txt".to_string(),
                original_filename: "renamed.txt".to_string(),
                file_path: "/renamed.txt".to_string(),
                file_size: 100,
                mime_type: "text/plain".to_string(),
                storage_backend: "local".to_string(),
                category: None,
                folder_id: None,
                content_sha256: None,
                is_favorite: false,
                is_pinned: false,
                last_opened_at: None,
                review_status: "approved".to_string(),
                created_at: Utc::now(),
                updated_at: Utc::now(),
                deleted_at: None,
            })
        }

        async fn list_by_folder(
            &self,
            _user_id: Uuid,
            _folder_id: Option<Uuid>,
        ) -> Result<Vec<File>, AppError> {
            Ok(Vec::new())
        }

        async fn delete(&self, _file_id: Uuid, _user_id: Uuid) -> Result<u64, AppError> {
            Ok(1)
        }

        async fn soft_delete(&self, _file_id: Uuid, _user_id: Uuid) -> Result<u64, AppError> {
            Ok(1)
        }

        async fn soft_delete_batch(&self, _ids: &[Uuid], _user_id: Uuid) -> Result<u64, AppError> {
            Ok(1)
        }

        async fn restore_deleted(&self, _file_id: Uuid, _user_id: Uuid) -> Result<File, AppError> {
            Ok(File {
                id: Uuid::new_v4(),
                user_id: Uuid::new_v4(),
                filename: "restored.txt".to_string(),
                original_filename: "restored.txt".to_string(),
                file_path: "/restored.txt".to_string(),
                file_size: 100,
                mime_type: "text/plain".to_string(),
                storage_backend: "local".to_string(),
                category: None,
                folder_id: None,
                content_sha256: None,
                is_favorite: false,
                is_pinned: false,
                last_opened_at: None,
                review_status: "approved".to_string(),
                created_at: Utc::now(),
                updated_at: Utc::now(),
                deleted_at: None,
            })
        }

        async fn list_deleted(&self, _user_id: Uuid) -> Result<Vec<File>, AppError> {
            Ok(Vec::new())
        }

        async fn hard_delete_deleted(
            &self,
            _file_id: Uuid,
            _user_id: Uuid,
        ) -> Result<u64, AppError> {
            Ok(1)
        }

        async fn hard_delete_deleted_batch(
            &self,
            _ids: &[Uuid],
            _user_id: Uuid,
        ) -> Result<Vec<File>, AppError> {
            Ok(Vec::new())
        }

        async fn hard_delete_all_deleted(&self, _user_id: Uuid) -> Result<Vec<File>, AppError> {
            Ok(Vec::new())
        }

        async fn purge_expired_deleted(
            &self,
            _retention_days: i64,
            _batch_limit: i64,
        ) -> Result<Vec<File>, AppError> {
            Ok(Vec::new())
        }

        async fn delete_batch(&self, _ids: &[Uuid], _user_id: Uuid) -> Result<u64, AppError> {
            Ok(1)
        }

        async fn get_storage_usage(&self, _user_id: Uuid) -> Result<(i64, u64), AppError> {
            Ok((1024, 10))
        }

        async fn list_categories(&self, _user_id: Uuid) -> Result<Vec<String>, AppError> {
            Ok(Vec::new())
        }

        async fn update_category(
            &self,
            _user_id: Uuid,
            _ids: &[Uuid],
            _category: Option<&str>,
            _updated_at: DateTime<Utc>,
        ) -> Result<u64, AppError> {
            Ok(1)
        }

        async fn sum_size_for_ids(
            &self,
            _user_id: Uuid,
            _ids: &[Uuid],
        ) -> Result<(i64, i64), AppError> {
            Ok((0, 0))
        }

        async fn find_by_ids(&self, _user_id: Uuid, _ids: &[Uuid]) -> Result<Vec<File>, AppError> {
            Ok(Vec::new())
        }

        async fn find_paths_by_ids(
            &self,
            _user_id: Uuid,
            _ids: &[Uuid],
        ) -> Result<Vec<(Uuid, String)>, AppError> {
            Ok(Vec::new())
        }

        async fn list(
            &self,
            _user_id: Uuid,
            _query: FileListQuery,
        ) -> Result<FileListResult, AppError> {
            Ok(FileListResult {
                files: Vec::new(),
                total: Some(0),
                next_cursor: None,
            })
        }
    }

    #[test]
    fn test_cached_files_repo_implements_trait() {
        // 编译时测试：验证 CachedFilesRepo 实现了 FilesRepository trait
        fn assert_trait_impl<T: FilesRepository>(_: T) {}
        let _ = assert_trait_impl::<CachedFilesRepo>;
        let _ = assert_trait_impl::<MockFilesRepo>;
    }
}
