//! 文件列表查询（分页/过滤/搜索）

use uuid::Uuid;
use deadpool_redis::{redis::cmd, Pool};
use serde_json::json;

use crate::config::CacheConfig;
use crate::services::redis::RedisService;
use crate::utils::crypto::sha256_hex;
use crate::models::file::{FileListQuery, FileResponse};
use crate::utils::AppError;

use super::FileService;

impl FileService {
    pub async fn list_files(
        &self,
        user_id: Uuid,
        query: FileListQuery,
    ) -> Result<(Vec<FileResponse>, Option<u64>, Option<String>), AppError> {
        let result = self.files_repo.list(user_id, query).await?;
        Ok((
            result.files.into_iter().map(FileResponse::from).collect(),
            result.total.map(|t| t as u64),
            result.next_cursor,
        ))
    }

    pub async fn list_files_cached(
        &self,
        user_id: Uuid,
        query: FileListQuery,
        redis_pool: Option<&Pool>,
        cache_config: &CacheConfig,
    ) -> Result<(Vec<FileResponse>, Option<u64>, Option<String>), AppError> {
        let page = query.page.unwrap_or(1);
        let is_cursor_pagination =
            query.cursor.is_some() || matches!(query.pagination.as_deref(), Some("cursor"));

        if cache_config.enabled && page == 1 && !is_cursor_pagination && query.include_total.unwrap_or(true) {
            if let Some(pool) = redis_pool {
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
                let redis = RedisService::new(pool.clone());
                let ver = redis.get_user_cache_version(user_id).await.unwrap_or(1);
                let cache_key = format!("cache:files:list:{}:{}:{}", user_id, ver, hash);

                if let Ok(mut conn) = pool.get().await {
                    let cached: Result<Option<String>, _> =
                        cmd("GET").arg(&cache_key).query_async(&mut conn).await;
                    if let Ok(Some(s)) = cached {
                        if let Ok(v) = serde_json::from_str::<serde_json::Value>(&s) {
                            // 从缓存中恢复 FileListResult
                            let files_result: crate::models::file::FileListResult = serde_json::from_value(v)?;
                            return Ok((
                                files_result.files.into_iter().map(FileResponse::from).collect(),
                                files_result.total.map(|t| t as u64),
                                files_result.next_cursor,
                            ));
                        }
                    }
                }

                let (files, total, next_cursor) = self.list_files(user_id, query.clone()).await?;
                let response_json = json!({
                    "files": files,
                    "total": total,
                    "next_cursor": next_cursor,
                    "page": query.page.unwrap_or(1),
                    "limit": query.limit.unwrap_or(20),
                });

                if let Ok(mut conn) = pool.get().await {
                    if let Ok(body) = serde_json::to_string(&response_json) {
                        let _: Result<(), _> = cmd("SETEX")
                            .arg(&cache_key)
                            .arg(cache_config.list_ttl_secs)
                            .arg(body)
                            .query_async(&mut conn)
                            .await;
                    }
                }
                return Ok((files, total, next_cursor));
            }
        }

        self.list_files(user_id, query).await
    }
}
