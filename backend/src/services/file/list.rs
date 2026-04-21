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

#[derive(serde::Serialize, serde::Deserialize)]
struct CachedFileListResponse {
    files: Vec<FileResponse>,
    total: Option<u64>,
    next_cursor: Option<String>,
}

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
                        if let Ok(cached_response) = serde_json::from_str::<CachedFileListResponse>(&s)
                        {
                            return Ok((
                                cached_response.files,
                                cached_response.total,
                                cached_response.next_cursor,
                            ));
                        }
                    }
                }

                let (files, total, next_cursor) = self.list_files(user_id, query.clone()).await?;
                let response_json = json!({
                    "files": files,
                    "total": total,
                    "next_cursor": next_cursor,
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

#[cfg(test)]
mod tests {
    use super::CachedFileListResponse;

    #[test]
    fn cached_file_list_response_deserializes_from_response_shape() {
        let file = crate::models::file::FileResponse {
            id: uuid::Uuid::new_v4(),
            filename: "a.txt".to_string(),
            original_filename: "a.txt".to_string(),
            file_size: 1,
            mime_type: "text/plain".to_string(),
            category: None,
            folder_id: None,
            created_at: chrono::Utc::now(),
        };

        let body = serde_json::json!({
            "files": [file],
            "total": 1u64,
            "next_cursor": null,
        })
        .to_string();

        let parsed = serde_json::from_str::<CachedFileListResponse>(&body).unwrap();
        assert_eq!(parsed.files.len(), 1);
        assert_eq!(parsed.total, Some(1));
        assert!(parsed.next_cursor.is_none());
    }
}
