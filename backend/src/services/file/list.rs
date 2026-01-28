//! 文件列表查询（分页/过滤/搜索）

use uuid::Uuid;

use crate::models::file::{File, FileListQuery, FileResponse};
use crate::utils::AppError;

use super::FileService;

impl FileService {
    pub async fn list_files(
        &self,
        user_id: Uuid,
        query: FileListQuery,
    ) -> Result<(Vec<FileResponse>, u64), AppError> {
        use chrono::{DateTime, NaiveDateTime, Utc};
        use sqlx::Row;

        let page = query.page.unwrap_or(1);
        let limit = query.limit.unwrap_or(20).min(100);
        let offset = (page - 1) * limit;

        // Prepare filter values in outer scope to avoid lifetime issues
        let search_pattern: Option<String> = query
            .search
            .as_deref()
            .filter(|s| !s.is_empty())
            .map(|s| format!("%{}%", s));
        // MIME type filter: support prefix matching (e.g., "image/" matches "image/png", "image/jpeg")
        let mime_type_filter: Option<String> = query
            .mime_type
            .as_deref()
            .filter(|s| !s.is_empty())
            .map(|s| {
                if s.ends_with('/') {
                    format!("{}%", s) // Prefix match: "image/" -> "image/%"
                } else {
                    s.to_string() // Exact match: "application/pdf"
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

        // Build WHERE clause dynamically
        let mut conditions = vec!["user_id = $1".to_string()];
        let mut param_index = 2u32;

        // Category filter: uncategorized (NULL or empty) vs exact match
        if category_filter_uncategorized {
            conditions.push("(category IS NULL OR category = '' OR TRIM(category) = '')".to_string());
        } else if category_filter_exact.is_some() {
            conditions.push(format!("category = ${}", param_index));
            param_index += 1;
        }

        // Folder ID filter
        let folder_id_filter: Option<Option<uuid::Uuid>> = query.folder_id.as_ref().map(|s| {
            let t = s.trim();
            if t.is_empty() || t.to_lowercase() == "null" || t == "root" {
                None // 根目录
            } else {
                uuid::Uuid::parse_str(t).ok()
            }
        });

        // 如果指定了 folder_id 参数，按文件夹过滤
        if let Some(folder_opt) = &folder_id_filter {
            if folder_opt.is_some() {
                conditions.push(format!("folder_id = ${}", param_index));
                param_index += 1;
            } else {
                conditions.push("folder_id IS NULL".to_string());
            }
        }

        // Search filter
        if search_pattern.is_some() {
            conditions.push(format!(
                "(original_filename ILIKE ${} OR filename ILIKE ${})",
                param_index, param_index
            ));
            param_index += 1;
        }

        // MIME type filter (supports prefix matching with LIKE)
        if mime_type_filter.is_some() {
            if mime_type_is_prefix {
                conditions.push(format!("mime_type LIKE ${}", param_index));
            } else {
                conditions.push(format!("mime_type = ${}", param_index));
            }
            param_index += 1;
        }

        // Date range filters
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
                NaiveDateTime::parse_from_str(s, "%Y-%m-%d").ok().map(|dt| {
                    // Add 23:59:59 to include the entire day
                    let end_of_day = dt.date().and_hms_opt(23, 59, 59).unwrap();
                    DateTime::<Utc>::from_naive_utc_and_offset(end_of_day, Utc)
                })
            })
            .or_else(|| {
                query.date_to.as_deref().and_then(|s| {
                    DateTime::parse_from_rfc3339(s)
                        .ok()
                        .map(|dt| dt.with_timezone(&Utc))
                })
            });

        if date_from.is_some() {
            conditions.push(format!("created_at >= ${}", param_index));
            param_index += 1;
        }

        if date_to.is_some() {
            conditions.push(format!("created_at <= ${}", param_index));
            param_index += 1;
        }

        // File size filters
        if query.size_min.is_some() {
            conditions.push(format!("file_size >= ${}", param_index));
            param_index += 1;
        }

        if query.size_max.is_some() {
            conditions.push(format!("file_size <= ${}", param_index));
            param_index += 1;
        }

        let where_clause = if conditions.is_empty() {
            String::new()
        } else {
            format!("WHERE {}", conditions.join(" AND "))
        };

        // 构建排序子句
        let sort_column = match query.sort_by.as_deref() {
            Some("filename") => "original_filename",
            Some("file_size") => "file_size",
            Some("created_at") | None => "created_at",
            _ => "created_at", // 默认按创建时间
        };
        let sort_direction = match query.sort_order.as_deref() {
            Some("asc") => "ASC",
            Some("desc") | None => "DESC",
            _ => "DESC", // 默认降序
        };
        let order_clause = format!("{} {}", sort_column, sort_direction);

        // Build query with dynamic WHERE clause.
        // 使用 COUNT(*) OVER() 将 total 合并到同一条查询，避免额外的 COUNT(*) 查询压垮连接池。
        let query_sql = format!(
            "SELECT id, user_id, filename, original_filename, file_path, file_size, mime_type, storage_backend, category, folder_id, created_at, updated_at, COUNT(*) OVER() AS total_count \
             FROM files {} ORDER BY {} LIMIT ${} OFFSET ${}",
            where_clause,
            order_clause,
            param_index,
            param_index + 1
        );

        // Build query with bindings (using query for dynamic SQL)
        let mut query_builder = sqlx::query(&query_sql);
        query_builder = query_builder.bind(user_id);

        if let Some(ref cat) = category_filter_exact {
            query_builder = query_builder.bind(cat);
        }

        // Bind folder_id if specified and not null (null case uses IS NULL in WHERE)
        if let Some(Some(fid)) = &folder_id_filter {
            query_builder = query_builder.bind(*fid);
        }

        if let Some(ref search_pattern) = search_pattern {
            query_builder = query_builder.bind(search_pattern);
        }

        if let Some(ref mime_type) = mime_type_filter {
            query_builder = query_builder.bind(mime_type);
        }

        if let Some(df) = date_from {
            query_builder = query_builder.bind(df);
        }

        if let Some(dt) = date_to {
            query_builder = query_builder.bind(dt);
        }

        if let Some(size_min) = query.size_min {
            query_builder = query_builder.bind(size_min);
        }

        if let Some(size_max) = query.size_max {
            query_builder = query_builder.bind(size_max);
        }

        query_builder = query_builder.bind(limit as i64);
        query_builder = query_builder.bind(offset as i64);

        // 为列表查询设置更短的 statement_timeout，避免慢查询长时间占用连接导致雪崩。
        // 使用 SET LOCAL（事务内生效），避免把设置“污染”到连接池中的其它请求。
        let mut tx = self.pool.begin().await?;
        sqlx::query("SET LOCAL statement_timeout = '3s'")
            .execute(&mut *tx)
            .await?;

        let rows = query_builder.fetch_all(&mut *tx).await?;
        tx.commit().await?;
        let total: i64 = rows
            .first()
            .and_then(|row| row.try_get::<i64, _>("total_count").ok())
            .unwrap_or(0);
        let files: Vec<File> = rows
            .into_iter()
            .map(|row| sqlx::FromRow::from_row(&row).map_err(AppError::Database))
            .collect::<Result<Vec<_>, _>>()?;

        let responses: Vec<FileResponse> = files.into_iter().map(FileResponse::from).collect();
        Ok((responses, total as u64))
    }
}

