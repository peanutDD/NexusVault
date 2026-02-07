//! # 文件数据访问层 - SQLx 实现
//!
//! 提供 `FilesRepository` trait 的 PostgreSQL/SQLx 实现。

use async_trait::async_trait;
use chrono::{DateTime, NaiveDateTime, Utc};
use sqlx::{postgres::PgRow, PgPool, Row};
use uuid::Uuid;

use crate::models::file::{File, FileListQuery};
use crate::repositories::traits::FilesRepository;
use crate::utils::AppError;

/// SQLx 实现的文件仓库
///
/// 持有 `PgPool` 句柄，通过 `Arc<dyn FilesRepository>` 注入到 Service。
pub struct SqlxFilesRepo {
    pool: PgPool,
}

impl SqlxFilesRepo {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl FilesRepository for SqlxFilesRepo {
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
    ) -> Result<File, AppError> {
        sqlx::query_as::<_, File>(
            "INSERT INTO files (id, user_id, filename, original_filename, file_path, file_size, mime_type, storage_backend, content_sha256, folder_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *",
        )
        .bind(file_id)
        .bind(user_id)
        .bind(storage_filename)
        .bind(original_filename)
        .bind(file_path)
        .bind(file_size as i64)
        .bind(mime_type)
        .bind(storage_backend)
        .bind(content_sha256)
        .bind(folder_id)
        .fetch_one(&self.pool)
        .await
        .map_err(AppError::from)
    }

    async fn find_by_content_hash_and_size(
        &self,
        content_sha256: &str,
        file_size: u64,
    ) -> Result<Option<File>, AppError> {
        sqlx::query_as::<_, File>(
            "SELECT * FROM files WHERE content_sha256 = $1 AND file_size = $2 LIMIT 1",
        )
        .bind(content_sha256)
        .bind(file_size as i64)
        .fetch_optional(&self.pool)
        .await
        .map_err(AppError::from)
    }

    async fn count_by_file_path(&self, file_path: &str) -> Result<u64, AppError> {
        let count: (i64,) = sqlx::query_as("SELECT COUNT(*)::BIGINT FROM files WHERE file_path = $1")
            .bind(file_path)
            .fetch_one(&self.pool)
            .await?;
        Ok(count.0 as u64)
    }

    async fn find_by_id(&self, file_id: Uuid, user_id: Uuid) -> Result<Option<File>, AppError> {
        sqlx::query_as::<_, File>("SELECT * FROM files WHERE id = $1 AND user_id = $2")
            .bind(file_id)
            .bind(user_id)
            .fetch_optional(&self.pool)
            .await
            .map_err(AppError::from)
    }

    async fn belongs_to_user(&self, file_id: Uuid, user_id: Uuid) -> Result<bool, AppError> {
        let result: Option<Uuid> =
            sqlx::query_scalar("SELECT id FROM files WHERE id = $1 AND user_id = $2")
                .bind(file_id)
                .bind(user_id)
                .fetch_optional(&self.pool)
                .await?;
        Ok(result.is_some())
    }

    async fn list_by_folder(
        &self,
        user_id: Uuid,
        folder_id: Option<Uuid>,
    ) -> Result<Vec<File>, AppError> {
        if folder_id.is_some() {
            sqlx::query_as::<_, File>(
                "SELECT * FROM files WHERE user_id = $1 AND folder_id = $2 ORDER BY created_at DESC",
            )
            .bind(user_id)
            .bind(folder_id)
            .fetch_all(&self.pool)
            .await
            .map_err(AppError::from)
        } else {
            sqlx::query_as::<_, File>(
                "SELECT * FROM files WHERE user_id = $1 AND folder_id IS NULL ORDER BY created_at DESC",
            )
            .bind(user_id)
            .fetch_all(&self.pool)
            .await
            .map_err(AppError::from)
        }
    }

    async fn delete(&self, file_id: Uuid, user_id: Uuid) -> Result<u64, AppError> {
        let result = sqlx::query("DELETE FROM files WHERE id = $1 AND user_id = $2")
            .bind(file_id)
            .bind(user_id)
            .execute(&self.pool)
            .await?;
        Ok(result.rows_affected())
    }

    async fn delete_batch(&self, ids: &[Uuid], user_id: Uuid) -> Result<u64, AppError> {
        if ids.is_empty() {
            return Ok(0);
        }
        let result = sqlx::query("DELETE FROM files WHERE user_id = $1 AND id = ANY($2)")
            .bind(user_id)
            .bind(ids)
            .execute(&self.pool)
            .await?;
        Ok(result.rows_affected())
    }

    async fn get_storage_usage(&self, user_id: Uuid) -> Result<(i64, u64), AppError> {
        let result: Option<(i64, i64)> = sqlx::query_as(
            "SELECT COALESCE(SUM(file_size)::BIGINT, 0), COUNT(*)::BIGINT FROM files WHERE user_id = $1",
        )
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await?;

        match result {
            Some((total_size, file_count)) => Ok((total_size, file_count as u64)),
            None => Ok((0, 0)),
        }
    }

    async fn list_categories(&self, user_id: Uuid) -> Result<Vec<String>, AppError> {
        sqlx::query_scalar::<_, String>(
            "SELECT DISTINCT category FROM files WHERE user_id = $1 AND category IS NOT NULL AND TRIM(category) != '' ORDER BY category",
        )
        .bind(user_id)
        .fetch_all(&self.pool)
        .await
        .map_err(AppError::from)
    }

    async fn update_category(
        &self,
        user_id: Uuid,
        ids: &[Uuid],
        category: Option<&str>,
        updated_at: DateTime<Utc>,
    ) -> Result<u64, AppError> {
        let result = sqlx::query(
            "UPDATE files SET category = $1, updated_at = $2 WHERE user_id = $3 AND id = ANY($4)",
        )
        .bind(category)
        .bind(updated_at)
        .bind(user_id)
        .bind(ids)
        .execute(&self.pool)
        .await?;

        Ok(result.rows_affected())
    }

    async fn sum_size_for_ids(&self, user_id: Uuid, ids: &[Uuid]) -> Result<(i64, i64), AppError> {
        let (found_count, total_size): (i64, i64) = sqlx::query_as(
            "SELECT COUNT(*)::BIGINT, COALESCE(SUM(file_size)::BIGINT, 0) \
             FROM files WHERE user_id = $1 AND id = ANY($2)",
        )
        .bind(user_id)
        .bind(ids)
        .fetch_one(&self.pool)
        .await?;
        Ok((found_count, total_size))
    }

    async fn find_by_ids(&self, user_id: Uuid, ids: &[Uuid]) -> Result<Vec<File>, AppError> {
        sqlx::query_as::<_, File>("SELECT * FROM files WHERE user_id = $1 AND id = ANY($2)")
            .bind(user_id)
            .bind(ids)
            .fetch_all(&self.pool)
            .await
            .map_err(AppError::from)
    }

    async fn find_paths_by_ids(
        &self,
        user_id: Uuid,
        ids: &[Uuid],
    ) -> Result<Vec<(Uuid, String)>, AppError> {
        sqlx::query_as::<_, (Uuid, String)>(
            "SELECT id, file_path FROM files WHERE user_id = $1 AND id = ANY($2)",
        )
        .bind(user_id)
        .bind(ids)
        .fetch_all(&self.pool)
        .await
        .map_err(AppError::from)
    }

    async fn list(&self, user_id: Uuid, query: FileListQuery) -> Result<(Vec<File>, i64), AppError> {
        use sqlx::QueryBuilder;

        let page = query.page.unwrap_or(1);
        let limit = query.limit.unwrap_or(20).min(100);
        let offset = (page - 1) * limit;

        // ---- filters (pre-parse) ----
        let search_pattern: Option<String> = query
            .search
            .as_deref()
            .filter(|s| !s.is_empty())
            .map(|s| format!("%{}%", s));

        let mime_type_filter: Option<String> = query
            .mime_type
            .as_deref()
            .filter(|s| !s.is_empty())
            .map(|s| {
                if s.ends_with('/') {
                    format!("{}%", s)
                } else {
                    s.to_string()
                }
            });
        let mime_type_is_prefix = query
            .mime_type
            .as_deref()
            .map(|s| s.ends_with('/'))
            .unwrap_or(false);

        let category_filter_uncategorized = query
            .category
            .as_deref()
            .map(|s| s.trim().is_empty())
            .unwrap_or(false);
        let category_filter_exact: Option<String> = query.category.as_ref().and_then(|s| {
            let t = s.trim();
            if t.is_empty() {
                None
            } else {
                Some(t.to_string())
            }
        });

        // 根目录（null/root/空）不按 folder_id 过滤，列表页展示该用户全部文件；传具体 folder UUID 时只返回该文件夹下文件。
        let folder_id_filter: Option<Option<Uuid>> = query.folder_id.as_ref().and_then(|s| {
            let t = s.trim();
            if t.is_empty() || t.to_lowercase() == "null" || t == "root" {
                None // 不传条件，返回全部
            } else {
                Uuid::parse_str(t).ok().map(Some)
            }
        });

        let date_from: Option<DateTime<Utc>> = query
            .date_from
            .as_deref()
            .and_then(|s| {
                NaiveDateTime::parse_from_str(s, "%Y-%m-%d")
                    .ok()
                    .map(|dt| DateTime::<Utc>::from_naive_utc_and_offset(dt, Utc))
            })
            .or_else(|| {
                query.date_from.as_deref().and_then(|s| {
                    DateTime::parse_from_rfc3339(s)
                        .ok()
                        .map(|dt| dt.with_timezone(&Utc))
                })
            });

        let date_to: Option<DateTime<Utc>> = query
            .date_to
            .as_deref()
            .and_then(|s| {
                NaiveDateTime::parse_from_str(s, "%Y-%m-%d")
                    .ok()
                    .and_then(|dt| {
                        dt.date()
                            .and_hms_opt(23, 59, 59)
                            .map(|end_of_day| DateTime::<Utc>::from_naive_utc_and_offset(end_of_day, Utc))
                    })
            })
            .or_else(|| {
                query.date_to.as_deref().and_then(|s| {
                    DateTime::parse_from_rfc3339(s)
                        .ok()
                        .map(|dt| dt.with_timezone(&Utc))
                })
            });

        // ---- sort (whitelist) ----
        let sort_column = match query.sort_by.as_deref() {
            Some("filename") => "original_filename",
            Some("file_size") => "file_size",
            Some("created_at") | None => "created_at",
            _ => "created_at",
        };
        let sort_direction = match query.sort_order.as_deref() {
            Some("asc") => "ASC",
            Some("desc") | None => "DESC",
            _ => "DESC",
        };

        // ---- build SQL ----
        let mut qb: QueryBuilder<sqlx::Postgres> = QueryBuilder::new(
            "SELECT id, user_id, filename, original_filename, file_path, file_size, mime_type, storage_backend, category, folder_id, content_sha256, created_at, updated_at, COUNT(*) OVER() AS total_count FROM files WHERE user_id = ",
        );
        qb.push_bind(user_id);

        if category_filter_uncategorized {
            qb.push(" AND (category IS NULL OR category = '' OR TRIM(category) = '')");
        } else if let Some(cat) = &category_filter_exact {
            qb.push(" AND category = ");
            qb.push_bind(cat);
        }

        if let Some(folder_opt) = &folder_id_filter {
            if let Some(fid) = folder_opt {
                qb.push(" AND folder_id = ");
                qb.push_bind(*fid);
            } else {
                qb.push(" AND folder_id IS NULL");
            }
        }

        if let Some(sp) = &search_pattern {
            qb.push(" AND (original_filename ILIKE ");
            qb.push_bind(sp);
            qb.push(" OR filename ILIKE ");
            qb.push_bind(sp);
            qb.push(")");
        }

        if let Some(mt) = &mime_type_filter {
            if mime_type_is_prefix {
                qb.push(" AND mime_type LIKE ");
            } else {
                qb.push(" AND mime_type = ");
            }
            qb.push_bind(mt);
        }

        if let Some(df) = date_from {
            qb.push(" AND created_at >= ");
            qb.push_bind(df);
        }

        if let Some(dt) = date_to {
            qb.push(" AND created_at <= ");
            qb.push_bind(dt);
        }

        if let Some(size_min) = query.size_min {
            qb.push(" AND file_size >= ");
            qb.push_bind(size_min);
        }

        if let Some(size_max) = query.size_max {
            qb.push(" AND file_size <= ");
            qb.push_bind(size_max);
        }

        qb.push(" ORDER BY ");
        qb.push(sort_column);
        qb.push(" ");
        qb.push(sort_direction);
        qb.push(" LIMIT ");
        qb.push_bind(limit as i64);
        qb.push(" OFFSET ");
        qb.push_bind(offset as i64);

        // statement_timeout：事务内 SET LOCAL，避免污染连接池
        let mut tx = self.pool.begin().await?;
        sqlx::query("SET LOCAL statement_timeout = '3s'")
            .execute(&mut *tx)
            .await?;

        let rows: Vec<PgRow> = qb.build().fetch_all(&mut *tx).await?;
        tx.commit().await?;

        let total: i64 = rows
            .first()
            .and_then(|row| row.try_get::<i64, _>("total_count").ok())
            .unwrap_or(0);

        let files: Vec<File> = rows
            .into_iter()
            .map(|row| sqlx::FromRow::from_row(&row).map_err(AppError::Database))
            .collect::<Result<Vec<_>, _>>()?;

        Ok((files, total))
    }
}
