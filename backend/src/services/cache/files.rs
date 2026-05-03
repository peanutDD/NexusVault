//! # 文件元数据 Redis 缓存服务
//!
//! 为文件列表和存储用量提供 Redis 二级缓存（L2），跨实例共享。
//! 采用「cache version + per-user scoped key」策略实现粗粒度失效。

use std::sync::Arc;

use deadpool_redis::{redis::cmd, Pool};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::config::CacheConfig;
use crate::models::file::{FileListQuery, FileListResult};
use crate::services::redis::RedisService;
use crate::utils::crypto::sha256_hex;
use crate::utils::AppError;

// =============================================================================
// 缓存键前缀
// =============================================================================

pub const CACHE_PREFIX_FILES_LIST: &str = "cache:files:list";
pub const CACHE_PREFIX_STORAGE_USAGE: &str = "cache:files:usage";
pub const CACHE_PREFIX_FOLDERS_LIST: &str = "cache:folders:list";
pub const CACHE_PREFIX_FOLDERS_CONTENTS: &str = "cache:folders:contents";

// =============================================================================
// 缓存响应结构
// =============================================================================

#[derive(Debug, Serialize, Deserialize)]
pub struct CachedFileListResponse {
    files: Vec<crate::models::file::File>,
    total: Option<i64>,
    next_cursor: Option<String>,
}

impl From<FileListResult> for CachedFileListResponse {
    fn from(result: FileListResult) -> Self {
        Self {
            files: result.files,
            total: result.total,
            next_cursor: result.next_cursor,
        }
    }
}

impl From<&FileListResult> for CachedFileListResponse {
    fn from(result: &FileListResult) -> Self {
        Self {
            files: result.files.clone(),
            total: result.total,
            next_cursor: result.next_cursor.clone(),
        }
    }
}

impl From<CachedFileListResponse> for FileListResult {
    fn from(cached: CachedFileListResponse) -> Self {
        Self {
            files: cached.files,
            total: cached.total,
            next_cursor: cached.next_cursor,
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CachedStorageUsage {
    total_size: i64,
    file_count: u64,
}

// =============================================================================
// FileCacheService
// =============================================================================

#[derive(Clone)]
pub struct FileCacheService {
    redis: RedisService,
    config: Arc<CacheConfig>,
}

impl FileCacheService {
    pub fn new(pool: Pool, config: Arc<CacheConfig>) -> Self {
        Self {
            redis: RedisService::new(pool),
            config,
        }
    }

    // -------------------------------------------------------------------------
    // 缓存键生成（确定性哈希）
    // -------------------------------------------------------------------------

    fn build_list_cache_key(&self, user_id: Uuid, version: i64, query: &FileListQuery) -> String {
        let fingerprint = format!(
            "page={:?}&limit={:?}&pagination={:?}&cursor={:?}&search={:?}&mime_type={:?}&category={:?}&folder_id={:?}&date_from={:?}&date_to={:?}&size_min={:?}&size_max={:?}&sort_by={:?}&sort_order={:?}&include_total={:?}",
            query.page,
            query.limit,
            query.pagination,
            query.cursor,
            query.search,
            query.mime_type,
            query.category,
            query.folder_id,
            query.date_from,
            query.date_to,
            query.size_min,
            query.size_max,
            query.sort_by,
            query.sort_order,
            query.include_total,
        );
        let hash = sha256_hex(fingerprint.as_bytes());
        format!(
            "{}:{}:{}:{}",
            CACHE_PREFIX_FILES_LIST, user_id, version, hash
        )
    }

    fn build_storage_usage_key(&self, user_id: Uuid, version: i64) -> String {
        format!("{}:{}:{}", CACHE_PREFIX_STORAGE_USAGE, user_id, version)
    }

    // -------------------------------------------------------------------------
    // 文件列表缓存
    // -------------------------------------------------------------------------

    /// 判断是否应该缓存该查询
    /// 仅当：无搜索、无日期范围、无大小范围、非游标分页时才缓存
    pub fn should_cache_list_query(&self, query: &FileListQuery) -> bool {
        if !self.config.enabled {
            return false;
        }

        // 游标分页不缓存
        if query.cursor.is_some() || matches!(query.pagination.as_deref(), Some("cursor")) {
            return false;
        }

        // 有搜索条件不缓存（高基数）
        if query.search.as_deref().is_some_and(|s| !s.is_empty()) {
            return false;
        }

        // 有日期范围不缓存（高基数）
        if query.date_from.is_some() || query.date_to.is_some() {
            return false;
        }

        // 有大小范围不缓存（高基数）
        if query.size_min.is_some() || query.size_max.is_some() {
            return false;
        }

        true
    }

    /// 获取文件列表缓存
    pub async fn get_files_list(
        &self,
        user_id: Uuid,
        query: &FileListQuery,
    ) -> Result<Option<FileListResult>, AppError> {
        if !self.should_cache_list_query(query) {
            return Ok(None);
        }

        let version = self.get_user_cache_version(user_id).await?;
        let cache_key = self.build_list_cache_key(user_id, version, query);

        match self.redis.pool().get().await {
            Ok(mut conn) => {
                let cached: Result<Option<String>, _> =
                    cmd("GET").arg(&cache_key).query_async(&mut conn).await;

                match cached {
                    Ok(Some(s)) => match serde_json::from_str::<CachedFileListResponse>(&s) {
                        Ok(cached_response) => Ok(Some(cached_response.into())),
                        Err(e) => {
                            tracing::warn!(error = %e, "Failed to deserialize cached file list");
                            Ok(None)
                        }
                    },
                    Ok(None) => Ok(None),
                    Err(e) => {
                        tracing::warn!(error = %e, "Redis GET failed for file list cache");
                        Ok(None)
                    }
                }
            }
            Err(e) => {
                tracing::warn!(error = %e, "Redis connection failed for file list cache");
                Ok(None)
            }
        }
    }

    /// 设置文件列表缓存
    pub async fn set_files_list(
        &self,
        user_id: Uuid,
        query: &FileListQuery,
        result: &FileListResult,
    ) -> Result<(), AppError> {
        if !self.should_cache_list_query(query) {
            return Ok(());
        }

        let version = self.get_user_cache_version(user_id).await?;
        let cache_key = self.build_list_cache_key(user_id, version, query);
        let cached_response: CachedFileListResponse = result.into();

        match serde_json::to_string(&cached_response) {
            Ok(body) => match self.redis.pool().get().await {
                Ok(mut conn) => {
                    let _: Result<(), _> = cmd("SETEX")
                        .arg(&cache_key)
                        .arg(self.config.list_ttl_secs)
                        .arg(body)
                        .query_async(&mut conn)
                        .await;
                }
                Err(e) => {
                    tracing::warn!(error = %e, "Redis connection failed for set file list");
                }
            },
            Err(e) => {
                tracing::warn!(error = %e, "Failed to serialize file list for cache");
            }
        }

        Ok(())
    }

    // -------------------------------------------------------------------------
    // 存储用量缓存
    // -------------------------------------------------------------------------

    /// 获取存储用量缓存
    pub async fn get_storage_usage(&self, user_id: Uuid) -> Result<Option<(i64, u64)>, AppError> {
        if !self.config.enabled {
            return Ok(None);
        }

        let version = self.get_user_cache_version(user_id).await?;
        let cache_key = self.build_storage_usage_key(user_id, version);

        match self.redis.pool().get().await {
            Ok(mut conn) => {
                let cached: Result<Option<String>, _> =
                    cmd("GET").arg(&cache_key).query_async(&mut conn).await;

                match cached {
                    Ok(Some(s)) => match serde_json::from_str::<CachedStorageUsage>(&s) {
                        Ok(cached_response) => Ok(Some((
                            cached_response.total_size,
                            cached_response.file_count,
                        ))),
                        Err(e) => {
                            tracing::warn!(error = %e, "Failed to deserialize cached storage usage");
                            Ok(None)
                        }
                    },
                    Ok(None) => Ok(None),
                    Err(e) => {
                        tracing::warn!(error = %e, "Redis GET failed for storage usage cache");
                        Ok(None)
                    }
                }
            }
            Err(e) => {
                tracing::warn!(error = %e, "Redis connection failed for storage usage cache");
                Ok(None)
            }
        }
    }

    /// 设置存储用量缓存
    pub async fn set_storage_usage(
        &self,
        user_id: Uuid,
        total_size: i64,
        file_count: u64,
    ) -> Result<(), AppError> {
        if !self.config.enabled {
            return Ok(());
        }

        let version = self.get_user_cache_version(user_id).await?;
        let cache_key = self.build_storage_usage_key(user_id, version);

        let cached_response = CachedStorageUsage {
            total_size,
            file_count,
        };

        match serde_json::to_string(&cached_response) {
            Ok(body) => match self.redis.pool().get().await {
                Ok(mut conn) => {
                    let _: Result<(), _> = cmd("SETEX")
                        .arg(&cache_key)
                        .arg(self.config.default_ttl_secs)
                        .arg(body)
                        .query_async(&mut conn)
                        .await;
                }
                Err(e) => {
                    tracing::warn!(error = %e, "Redis connection failed for set storage usage");
                }
            },
            Err(e) => {
                tracing::warn!(error = %e, "Failed to serialize storage usage for cache");
            }
        }

        Ok(())
    }

    // -------------------------------------------------------------------------
    // 用户缓存版本管理
    // -------------------------------------------------------------------------

    /// 获取用户缓存版本号
    pub async fn get_user_cache_version(&self, user_id: Uuid) -> Result<i64, AppError> {
        self.redis.get_user_cache_version(user_id).await
    }

    /// 使用户缓存失效（递增版本号）
    pub async fn invalidate_user_cache(&self, user_id: Uuid) -> Result<i64, AppError> {
        self.redis.bump_user_cache_version(user_id).await
    }
}

// =============================================================================
// 测试
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::file::{File, FileListQuery};
    use chrono::Utc;
    use uuid::Uuid;

    /// 创建测试用的 FileCacheService（不依赖真实 Redis）
    fn create_test_service() -> FileCacheService {
        let config = deadpool_redis::Config::from_url("redis://localhost:6379");
        let pool = config
            .create_pool(Some(deadpool_redis::Runtime::Tokio1))
            .unwrap();

        FileCacheService {
            redis: RedisService::new(pool),
            config: Arc::new(CacheConfig {
                enabled: true,
                default_ttl_secs: 300,
                list_ttl_secs: 300,
            }),
        }
    }

    #[test]
    fn test_cache_key_generation_is_deterministic() {
        let user_id = Uuid::parse_str("12345678-1234-5678-1234-567812345678").unwrap();
        let version = 1;

        let query1 = FileListQuery {
            page: Some(1),
            limit: Some(20),
            ..Default::default()
        };
        let query2 = FileListQuery {
            page: Some(1),
            limit: Some(20),
            ..Default::default()
        };

        let service = create_test_service();

        let key1 = service.build_list_cache_key(user_id, version, &query1);
        let key2 = service.build_list_cache_key(user_id, version, &query2);

        assert_eq!(key1, key2);
    }

    #[test]
    fn test_cache_key_changes_with_query_params() {
        let user_id = Uuid::parse_str("12345678-1234-5678-1234-567812345678").unwrap();
        let version = 1;

        let query1 = FileListQuery {
            page: Some(1),
            limit: Some(20),
            ..Default::default()
        };
        let query2 = FileListQuery {
            page: Some(2),
            limit: Some(20),
            ..Default::default()
        };

        let service = create_test_service();

        let key1 = service.build_list_cache_key(user_id, version, &query1);
        let key2 = service.build_list_cache_key(user_id, version, &query2);

        assert_ne!(key1, key2);
    }

    #[test]
    fn test_cache_key_scoped_by_user_version() {
        let user_id = Uuid::parse_str("12345678-1234-5678-1234-567812345678").unwrap();

        let query = FileListQuery {
            page: Some(1),
            limit: Some(20),
            ..Default::default()
        };

        let service = create_test_service();

        let key_v1 = service.build_list_cache_key(user_id, 1, &query);
        let key_v2 = service.build_list_cache_key(user_id, 2, &query);

        assert_ne!(key_v1, key_v2);
    }

    #[test]
    fn test_should_cache_list_query_filters() {
        let service = create_test_service();

        // 基础查询应该缓存
        let basic_query = FileListQuery {
            page: Some(1),
            limit: Some(20),
            ..Default::default()
        };
        assert!(service.should_cache_list_query(&basic_query));

        // 有搜索不缓存
        let search_query = FileListQuery {
            search: Some("test".to_string()),
            ..Default::default()
        };
        assert!(!service.should_cache_list_query(&search_query));

        // 有日期范围不缓存
        let date_query = FileListQuery {
            date_from: Some("2024-01-01".to_string()),
            ..Default::default()
        };
        assert!(!service.should_cache_list_query(&date_query));

        // 游标分页不缓存
        let cursor_query = FileListQuery {
            cursor: Some("abc".to_string()),
            ..Default::default()
        };
        assert!(!service.should_cache_list_query(&cursor_query));
    }

    #[test]
    fn test_cached_file_list_response_round_trip() {
        let file = File {
            id: Uuid::new_v4(),
            user_id: Uuid::new_v4(),
            filename: "test.txt".to_string(),
            original_filename: "test.txt".to_string(),
            file_path: "/test/test.txt".to_string(),
            file_size: 100,
            mime_type: "text/plain".to_string(),
            storage_backend: "local".to_string(),
            category: None,
            folder_id: None,
            content_sha256: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        let result = FileListResult {
            files: vec![file],
            total: Some(1),
            next_cursor: None,
        };

        let cached: CachedFileListResponse = result.clone().into();
        let restored: FileListResult = cached.into();

        assert_eq!(restored.files.len(), 1);
        assert_eq!(restored.total, Some(1));
        assert!(restored.next_cursor.is_none());
    }
}
