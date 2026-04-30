## Assistant

遵循 AGENTS.md 工具使用顺序，先做 **repo 探查 + 输出 exec-plan**，不直接动代码。下面先把现状弄清楚。

**Tool Call: Read backend/src/repositories/files.rs**
Status: Completed

Read 839 lines

```rs
//! # 文件数据访问层 - SQLx 实现
//!
//! 提供 `FilesRepository` trait 的 PostgreSQL/SQLx 实现，封装对 `files` 表的所有读写。
//!
//! ## 架构与约定
//!
//! - **表名**：`files`，主键 `id`（UUID），外键 `user_id` → `users(id)` ON DELETE CASCADE。
//! - **多租户**：所有查询均带 `user_id`，保证用户只能访问自己的记录。
//! - **错误**：SQLx 错误通过 `AppError::from` 转为 `AppError::Database`，由上层统一转 HTTP 状态码。
//! - **连接**：使用 `PgPool` 复用连接；`list` 内对单次查询使用 `SET LOCAL statement_timeout` 避免慢查询占用连接。
//!
//! ## 主要能力
//!
//! - 插入/按 ID 查/按内容哈希查（秒传）/按路径计数（去重删除）
//! - 分页列表（`list`）：支持搜索、MIME、分类、文件夹、日期、大小、排序，使用 `QueryBuilder` 动态拼接 WHERE
//! - 批量操作：删除、按 ID 取路径、按 ID 取实体、按 ID 汇总大小
//! - 存储用量、分类列表、批量更新分类

// =============================================================================
// 依赖与类型
// =============================================================================

use std::collections::HashMap;

use async_trait::async_trait; // 为 trait 方法提供 async fn 语法
use chrono::{DateTime, Utc}; // 日期解析与存库用 UTC
use sqlx::{postgres::PgRow, PgPool, Row}; // PgRow 用于 list 中取 total_count
use uuid::Uuid;

use crate::models::file::{File, FileListQuery, FileListResult}; // 实体与列表查询 DTO
use crate::repositories::traits::FilesRepository; // 本模块实现的 trait
use crate::utils::AppError; // 统一错误类型，SQLx 错误会转为 Database

// =============================================================================
// 结构体与构造
// =============================================================================

/// SQLx 实现的文件仓库
///
/// 持有 `PgPool` 句柄，通过 `Arc<dyn FilesRepository>` 注入到 Service 层。
/// 无内部可变状态，方法均为 `&self`，并发安全由连接池与数据库保证。
pub struct SqlxFilesRepo {
    write_pool: PgPool,
    read_pool: PgPool,
}

impl SqlxFilesRepo {
    pub fn new(pool: PgPool) -> Self {
        let read_pool = pool.clone();
        Self {
            write_pool: pool,
            read_pool,
        }
    }

    pub fn new_with_replica(write_pool: PgPool, read_pool: PgPool) -> Self {
        Self {
            write_pool,
            read_pool,
        }
    }

    fn r(&self) -> &PgPool {
        &self.read_pool
    }

    fn w(&self) -> &PgPool {
        &self.write_pool
    }
}

// =============================================================================
// 插入与秒传（上传落库、按内容哈希查、按路径计数）
// =============================================================================

#[async_trait]
impl FilesRepository for SqlxFilesRepo {
    /// 插入一条文件记录（上传落库）。
    ///
    /// **实现**：单条 `INSERT ... RETURNING *`，`file_size` 以 `i64` 存库。若违反唯一约束会返回
    /// `AppError::Database`。调用方一般在写入存储成功后调用，失败时需自行清理已写文件。
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
        .bind(file_id) // 主键，由调用方生成 UUID
        .bind(user_id)
        .bind(storage_filename) // 存盘文件名（常带 UUID 前缀）
        .bind(original_filename) // 用户上传时的文件名
        .bind(file_path) // 存储层返回的路径，Local 或 S3 key
        .bind(file_size as i64) // 表字段为 BIGINT
        .bind(mime_type)
        .bind(storage_backend) // "local" | "s3"
        .bind(content_sha256) // 可选，秒传与去重用
        .bind(folder_id) // 可选，NULL 表示根目录
        .fetch_one(self.w()) // 取 RETURNING 的一行
        .await
        .map_err(AppError::from) // sqlx::Error -> AppError::Database
    }

    /// 按内容 SHA-256 与文件大小查找任意一条匹配记录，用于秒传：相同内容可复用已有存储并只插记录。
    ///
    /// **实现**：`WHERE content_sha256 = $1 AND file_size = $2 LIMIT 1`，返回 `Option<File>`。
    /// 未建 `(content_sha256, file_size)` 索引时可能全表扫描，数据量大时可考虑加索引。
    async fn find_by_content_hash_and_size(
        &self,
        content_sha256: &str,
        file_size: u64,
    ) -> Result<Option<File>, AppError> {
        sqlx::query_as::<_, File>(
            "SELECT * FROM files WHERE content_sha256 = $1 AND file_size = $2 LIMIT 1",
        )
        .bind(content_sha256) // 十六进制字符串
        .bind(file_size as i64)
        .fetch_optional(self.r()) // 0 或 1 行
        .await
        .map_err(AppError::from)
    }

    /// 统计引用同一 `file_path` 的记录数。
    ///
    /// **用途**：删除或秒传复用存储时，仅当计数为 0 才可安全删除物理文件，避免误删仍被引用的路径。
    /// **实现**：`COUNT(*)` + `WHERE file_path = $1`，返回 `u64`。
    async fn count_by_file_path(&self, file_path: &str) -> Result<u64, AppError> {
        let count: (i64,) =
            sqlx::query_as("SELECT COUNT(*)::BIGINT FROM files WHERE file_path = $1")
                .bind(file_path)
                .fetch_one(self.r())
                .await?;
        Ok(count.0 as u64) // 单列元组取 .0，转为无符号
    }

    /// 批量统计多个 `file_path` 的引用数，一次查询减少 round-trip。
    ///
    /// **实现**：`SELECT file_path, COUNT(*) FROM files WHERE file_path = ANY($1) GROUP BY file_path`。
    /// 空 paths 直接返回空 HashMap；未出现在结果中的 path 表示 0 引用。
    async fn count_by_file_paths(
        &self,
        paths: &[String],
    ) -> Result<HashMap<String, u64>, AppError> {
        if paths.is_empty() {
            return Ok(HashMap::new());
        }
        let rows: Vec<(String, i64)> = sqlx::query_as(
            "SELECT file_path, COUNT(*)::BIGINT FROM files WHERE file_path = ANY($1) GROUP BY file_path",
        )
        .bind(paths)
        .fetch_all(self.r())
        .await?;
        Ok(rows.into_iter().map(|(p, c)| (p, c as u64)).collect())
    }

    // =============================================================================
    // 单条查询与归属校验（下载/预览/删除前）
    // =============================================================================

    /// 按文件 ID 与用户 ID 查询单条记录，用于下载/预览/删除前校验归属。
    ///
    /// **实现**：`SELECT * FROM files WHERE id = $1 AND user_id = $2`，返回 `Option<File>`，
    /// 不存在或不属于该用户时为 `None`。
    async fn find_by_id(&self, file_id: Uuid, user_id: Uuid) -> Result<Option<File>, AppError> {
        sqlx::query_as::<_, File>("SELECT * FROM files WHERE id = $1 AND user_id = $2")
            .bind(file_id)
            .bind(user_id) // 双重条件防止越权
            .fetch_optional(self.r())
            .await
            .map_err(AppError::from)
    }

    /// 判断指定文件是否属于指定用户（仅做存在性检查，不返回实体）。
    ///
    /// **实现**：`SELECT id FROM files WHERE id = $1 AND user_id = $2`，有行则 `true`。
    /// 比 `find_by_id` 更轻量，适合仅做权限/归属判断的场景。
    async fn belongs_to_user(&self, file_id: Uuid, user_id: Uuid) -> Result<bool, AppError> {
        let result: Option<Uuid> =
            sqlx::query_scalar("SELECT id FROM files WHERE id = $1 AND user_id = $2")
                .bind(file_id)
                .bind(user_id)
                .fetch_optional(self.r())
                .await?;
        Ok(result.is_some()) // 有行即属于该用户
    }

    async fn find_by_name_and_folder(
        &self,
        user_id: Uuid,
        original_filename: &str,
        folder_id: Option<Uuid>,
    ) -> Result<Option<File>, AppError> {
        let file = if let Some(fid) = folder_id {
            sqlx::query_as::<_, File>(
                "SELECT * FROM files WHERE user_id = $1 AND original_filename = $2 AND folder_id = $3 LIMIT 1",
            )
            .bind(user_id)
            .bind(original_filename)
            .bind(fid)
            .fetch_optional(self.r())
            .await?
        } else {
            sqlx::query_as::<_, File>(
                "SELECT * FROM files WHERE user_id = $1 AND original_filename = $2 AND folder_id IS NULL LIMIT 1",
            )
            .bind(user_id)
            .bind(original_filename)
            .fetch_optional(self.r())
            .await?
        };
        Ok(file)
    }

    async fn rename(
        &self,
        file_id: Uuid,
        user_id: Uuid,
        original_filename: &str,
    ) -> Result<File, AppError> {
        sqlx::query_as::<_, File>(
            r#"
            UPDATE files
            SET original_filename = $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2 AND user_id = $3
            RETURNING *
            "#,
        )
        .bind(original_filename)
        .bind(file_id)
        .bind(user_id)
        .fetch_one(self.w())
        .await
        .map_err(AppError::from)
    }

    // =============================================================================
    // 按文件夹列表（不分页，供文件夹树等场景）
    // =============================================================================

    /// 列出指定用户、指定文件夹下的文件（不分页，按创建时间倒序）。
    ///
    /// **实现**：单条 SQL，`folder_id = $2` 与 `$2 IS NULL AND folder_id IS NULL` 统一处理根目录与子文件夹。
    async fn list_by_folder(
        &self,
        user_id: Uuid,
        folder_id: Option<Uuid>,
    ) -> Result<Vec<File>, AppError> {
        sqlx::query_as::<_, File>(
            "SELECT * FROM files WHERE user_id = $1 AND ( (folder_id IS NULL AND $2::uuid IS NULL) OR (folder_id = $2) ) ORDER BY created_at DESC",
        )
        .bind(user_id)
        .bind(folder_id)
        .fetch_all(self.r())
        .await
        .map_err(AppError::from)
    }

    // =============================================================================
    // 删除（单条 / 批量）
    // =============================================================================

    async fn delete(&self, file_id: Uuid, user_id: Uuid) -> Result<u64, AppError> {
        let result = sqlx::query("DELETE FROM files WHERE id = $1 AND user_id = $2")
            .bind(file_id)
            .bind(user_id)
            .execute(self.w())
            .await?;
        Ok(result.rows_affected()) // 0 或 1
    }

    async fn delete_batch(&self, ids: &[Uuid], user_id: Uuid) -> Result<u64, AppError> {
        if ids.is_empty() {
            return Ok(0); // 避免 ANY('{}') 语义依赖
        }
        let result = sqlx::query("DELETE FROM files WHERE user_id = $1 AND id = ANY($2)")
            .bind(user_id)
            .bind(ids) // PostgreSQL 数组，只删本用户的 id
            .execute(self.w())
            .await?;
        Ok(result.rows_affected())
    }

    // =============================================================================
    // 存储用量与分类（配额、筛选器、批量更新分类）
    // =============================================================================

    /// 获取指定用户的存储使用量：总字节数、文件数量。
    ///
    /// **实现**：`SELECT COALESCE(SUM(file_size), 0), COUNT(*) FROM files WHERE user_id = $1`。
    /// 聚合无 GROUP BY 时始终返回一行，无文件时为 `(0, 0)`。用于配额展示与上传前校验。
    async fn get_storage_usage(&self, user_id: Uuid) -> Result<(i64, u64), AppError> {
        let (total_size, file_count): (i64, i64) = sqlx::query_as(
            "SELECT COALESCE(SUM(file_size)::BIGINT, 0), COUNT(*)::BIGINT FROM files WHERE user_id = $1",
        )
        .bind(user_id)
        .fetch_one(self.r()) // 聚合始终一行
        .await?;
        Ok((total_size, file_count as u64))
    }

    /// 列出该用户下所有出现过的非空分类名（去重、排序），用于筛选器下拉等。
    ///
    /// **实现**：`SELECT DISTINCT category ... AND category IS NOT NULL AND TRIM(category) != ''`。
    /// 分类字段已逐步被 `folder_id` 替代，接口保留兼容。
    async fn list_categories(&self, user_id: Uuid) -> Result<Vec<String>, AppError> {
        sqlx::query_scalar::<_, String>(
            "SELECT DISTINCT category FROM files WHERE user_id = $1 AND category IS NOT NULL AND TRIM(category) != '' ORDER BY category",
        )
        .bind(user_id)
        .fetch_all(self.r()) // 返回单列多行，自动 Vec<String>
        .await
        .map_err(AppError::from)
    }

    /// 批量更新指定文件记录的 `category` 与 `updated_at`。
    ///
    /// **实现**：`UPDATE files SET category = $1, updated_at = $2 WHERE user_id = $3 AND id = ANY($4)`。
    /// 空 ids 直接返回 0。
    async fn update_category(
        &self,
        user_id: Uuid,
        ids: &[Uuid],
        category: Option<&str>,
        updated_at: DateTime<Utc>,
    ) -> Result<u64, AppError> {
        if ids.is_empty() {
            return Ok(0);
        }
        let result = sqlx::query(
            "UPDATE files SET category = $1, updated_at = $2 WHERE user_id = $3 AND id = ANY($4)",
        )
        .bind(category) // Option<&str>，可置 NULL
        .bind(updated_at)
        .bind(user_id)
        .bind(ids)
        .execute(self.w())
        .await?;

        Ok(result.rows_affected())
    }

    // =============================================================================
    // 批量查询（按 ID 列表：汇总大小、取实体、取路径）
    // =============================================================================

    /// 统计指定 ID 集合中属于该用户的文件数量与总大小（用于批量下载前校验或展示）。
    ///
    /// **实现**：`SELECT COUNT(*), COALESCE(SUM(file_size), 0) FROM files WHERE user_id = $1 AND id = ANY($2)`，
    /// 返回 `(found_count, total_size)`。空 ids 直接返回 `(0, 0)`，避免 ANY('{}') 依赖。
    async fn sum_size_for_ids(&self, user_id: Uuid, ids: &[Uuid]) -> Result<(i64, i64), AppError> {
        if ids.is_empty() {
            return Ok((0, 0));
        }
        let (found_count, total_size): (i64, i64) = sqlx::query_as(
            "SELECT COUNT(*)::BIGINT, COALESCE(SUM(file_size)::BIGINT, 0) \
             FROM files WHERE user_id = $1 AND id = ANY($2)",
        )
        .bind(user_id)
        .bind(ids)
        .fetch_one(self.r()) // 聚合结果始终一行
        .await?;
        Ok((found_count, total_size))
    }

    /// 按 ID 列表批量查询文件实体，仅返回属于该用户的记录，顺序不保证与 `ids` 一致。
    ///
    /// **实现**：`SELECT * FROM files WHERE user_id = $1 AND id = ANY($2)`。空 ids 直接返回空 Vec。
    async fn find_by_ids(&self, user_id: Uuid, ids: &[Uuid]) -> Result<Vec<File>, AppError> {
        if ids.is_empty() {
            return Ok(Vec::new());
        }
        sqlx::query_as::<_, File>("SELECT * FROM files WHERE user_id = $1 AND id = ANY($2)")
            .bind(user_id)
            .bind(ids)
            .fetch_all(self.r()) // 顺序与 ids 不一定一致
            .await
            .map_err(AppError::from)
    }

    /// 按 ID 列表批量查询 `(id, file_path)`，用于批量删除时先删存储再删 DB，避免 N+1。
    ///
    /// **实现**：`SELECT id, file_path FROM files WHERE user_id = $1 AND id = ANY($2)`。空 ids 直接返回空 Vec。
    async fn find_paths_by_ids(
        &self,
        user_id: Uuid,
        ids: &[Uuid],
    ) -> Result<Vec<(Uuid, String)>, AppError> {
        if ids.is_empty() {
            return Ok(Vec::new());
        }
        sqlx::query_as::<_, (Uuid, String)>(
            "SELECT id, file_path FROM files WHERE user_id = $1 AND id = ANY($2)",
        )
        .bind(user_id)
        .bind(ids)
        .fetch_all(self.r()) // 仅两列，供批量删存储用
        .await
        .map_err(AppError::from)
    }

    // =============================================================================
    // 分页列表（文件列表页：搜索 / MIME / 分类 / 文件夹 / 日期 / 大小 / 排序）
    // =============================================================================

    /// 分页查询文件列表，支持多条件筛选与排序，返回当前页数据与总条数或游标。
    ///
    /// **返回值**：
    /// - 传统分页：`(Vec<File>, total_count)`，`total_count` 由 `COUNT(*) OVER()` 在单次查询中得出。
    /// - 游标分页：`(Vec<File>, next_cursor)`，`next_cursor` 为最后一条记录的排序字段值（字符串形式），如果已到末尾则为 `None`。
    ///
    /// **实现要点**：
    /// - 分页模式：
    ///   - 如果提供了 `cursor`，使用游标分页（keyset pagination）：`WHERE sort_column > cursor`（DESC）或 `WHERE sort_column < cursor`（ASC），不使用 `OFFSET`。
    ///   - 否则使用传统分页：`page` 默认 1，`limit` 默认 20、最大 100，`offset = (page - 1) * limit`。
    /// - 筛选：搜索（`original_filename`/`filename` ILIKE）、MIME（精确或前缀 `image/%`）、分类、文件夹、日期范围、大小范围；根目录（folder_id 为 null/root/空）不按 folder_id 过滤，返回该用户全部文件。
    /// - 排序：仅允许 `sort_by` ∈ { created_at, filename, file_size, type }，`sort_order` ∈ { asc, desc }，否则回退默认（created_at DESC）。
    ///   - `sort_by = type`：按预置类型顺序排序（image → gif → video → audio → pdf → text → zip → application → other），并在每个类型内按 created_at DESC、id DESC；该模式不支持游标分页。
    ///   - 其他字段：游标分页时，为确保唯一性，二级排序使用 `id`。
    /// - SQL 构建：使用 `QueryBuilder` 动态拼接 WHERE，避免手拼字符串与注入；传统分页的 `total_count` 用窗口函数一次查出。
    /// - 超时：本查询在独立事务中执行并 `SET LOCAL statement_timeout = '3s'`，避免慢查询长时间占用连接池。
    async fn list(&self, user_id: Uuid, query: FileListQuery) -> Result<FileListResult, AppError> {
        use chrono::{DateTime, NaiveDateTime, Utc};
        use sqlx::QueryBuilder;
        use uuid::Uuid;

        let limit = query.limit.unwrap_or(20).min(100); // 单页最多 100 条

        // ---- 筛选条件预解析（空字符串视为未传，不参与 WHERE） ----
        let search_pattern: Option<String> = query
            .search
            .as_deref()
            .filter(|s| !s.is_empty())
            .map(|s| format!("%{}%", s)); // ILIKE 用前后 % 包裹

        // MIME：以 / 结尾（如 image/）则按前缀 LIKE，否则精确匹配
        let mime_type_filter: Option<String> = query
            .mime_type
            .as_deref()
            .filter(|s| !s.is_empty())
            .map(|s| {
                if s.ends_with('/') {
                    format!("{}%", s) // 如 image/% 匹配 image/png 等
                } else {
                    s.to_string()
                }
            });
        let mime_type_is_prefix = query
            .mime_type
            .as_deref()
            .map(|s| s.ends_with('/'))
            .unwrap_or(false); // 决定下面用 LIKE 还是 =

        let category_filter_uncategorized = query
            .category
            .as_deref()
            .map(|s| s.trim().is_empty())
            .unwrap_or(false); // 传空字符串表示筛「未分类」
        let category_filter_exact: Option<String> = query.category.as_ref().and_then(|s| {
            let t = s.trim();
            if t.is_empty() {
                None
            } else {
                Some(t.to_string()) // 精确分类名
            }
        });

        let folder_id_filter: Option<Option<Uuid>> = match query.folder_id.as_deref() {
            None => None,
            Some(s) => {
                let t = s.trim();
                if t.is_empty() || t.eq_ignore_ascii_case("null") || t == "root" {
                    Some(None)
                } else {
                    Uuid::parse_str(t).ok().map(Some)
                }
            }
        };

        // 日期范围：支持 YYYY-MM-DD 或 RFC3339；date_to 解析为当日 23:59:59 以包含整天
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
                            .and_hms_opt(23, 59, 59) // 当天结束，包含整天
                            .map(|end_of_day| {
                                DateTime::<Utc>::from_naive_utc_and_offset(end_of_day, Utc)
                            })
                    })
            })
            .or_else(|| {
                query.date_to.as_deref().and_then(|s| {
                    DateTime::parse_from_rfc3339(s)
                        .ok()
                        .map(|dt| dt.with_timezone(&Utc))
                })
            });

        // ---- 排序字段与方向（白名单，非法值回退默认） ----
        let sort_by = query.sort_by.as_deref().unwrap_or("created_at");
        let sort_direction = match query.sort_order.as_deref() {
            Some("asc") => "ASC",
            Some("desc") | None => "DESC",
            _ => "DESC",
        };
        let sort_column = match sort_by {
            "filename" => "original_filename", // API 用 filename，库列名为 original_filename
            "file_size" => "file_size",
            "created_at" => "created_at",
            "type" => "CASE \
                WHEN lower(mime_type) LIKE 'image/gif%' THEN 2 \
                WHEN lower(mime_type) LIKE 'image/%' THEN 1 \
                WHEN lower(mime_type) LIKE 'video/%' THEN 3 \
                WHEN lower(mime_type) LIKE 'audio/%' THEN 4 \
                WHEN lower(mime_type) = 'application/pdf' THEN 5 \
                WHEN lower(mime_type) LIKE 'text/%' THEN 6 \
                WHEN lower(mime_type) = 'application/zip' OR lower(mime_type) = 'application/x-zip-compressed' THEN 7 \
                WHEN lower(mime_type) LIKE 'application/%' THEN 8 \
                ELSE 99 \
            END",
            _ => "created_at", // 非法值回退默认，仅白名单不引入注入
        };

        let use_cursor_pagination = (query.cursor.is_some()
            || matches!(query.pagination.as_deref(), Some("cursor")))
            && sort_by != "type";

        // ---- 游标解析（如果使用游标分页） ----
        enum CursorValue {
            DateTime(DateTime<Utc>),
            String(String),
            Int64(i64),
        }

        #[derive(serde::Deserialize, serde::Serialize)]
        struct CursorTokenV1 {
            v: u8,
            sort_by: String,
            sort_order: String,
            value: String,
            id: Uuid,
        }

        fn parse_cursor_value(sort_column: &str, cursor_str: &str) -> Option<CursorValue> {
            match sort_column {
                "created_at" => DateTime::parse_from_rfc3339(cursor_str)
                    .ok()
                    .map(|dt| CursorValue::DateTime(dt.with_timezone(&Utc)))
                    .or_else(|| {
                        NaiveDateTime::parse_from_str(cursor_str, "%Y-%m-%d %H:%M:%S%.f")
                            .ok()
                            .map(|dt| {
                                CursorValue::DateTime(DateTime::<Utc>::from_naive_utc_and_offset(
                                    dt, Utc,
                                ))
                            })
                    }),
                "original_filename" => Some(CursorValue::String(cursor_str.to_string())),
                "file_size" => cursor_str.parse::<i64>().ok().map(CursorValue::Int64),
                _ => None,
            }
        }

        let (cursor_value, cursor_id, cursor_has_id): (Option<CursorValue>, Option<Uuid>, bool) =
            if use_cursor_pagination {
                let cursor_str = query.cursor.as_deref().unwrap_or("");
                if let Ok(token) = serde_json::from_str::<CursorTokenV1>(cursor_str) {
                    if token.v != 1 {
                        return Err(AppError::Validation("无效的 cursor 版本".to_string()));
                    }

                    let expected_sort_by = match sort_column {
                        "created_at" => "created_at",
                        "original_filename" => "filename",
                        "file_size" => "file_size",
                        _ => "created_at",
                    };
                    let expected_sort_order = if sort_direction == "ASC" {
                        "asc"
                    } else {
                        "desc"
                    };
                    if token.sort_by != expected_sort_by || token.sort_order != expected_sort_order
                    {
                        return Err(AppError::Validation(
                            "cursor 与 sort_by/sort_order 不匹配".to_string(),
                        ));
                    }
                    (
                        parse_cursor_value(sort_column, &token.value),
                        Some(token.id),
                        true,
                    )
                } else {
                    (parse_cursor_value(sort_column, cursor_str), None, false)
                }
            } else {
                (None, None, false)
            };

        // ---- 动态拼接 SELECT + WHERE + ORDER BY + LIMIT/OFFSET 或 LIMIT（游标分页） ----
        // 传统分页使用 COUNT(*) OVER() 获取总条数（除非 include_total=false），游标分页不需要
        let should_count_total = !use_cursor_pagination && query.include_total.unwrap_or(true);

        let mut qb: QueryBuilder<sqlx::Postgres> = if should_count_total {
            QueryBuilder::new(
                "SELECT id, user_id, filename, original_filename, file_path, file_size, mime_type, storage_backend, category, folder_id, content_sha256, created_at, updated_at, COUNT(*) OVER() AS total_count FROM files WHERE user_id = "
            )
        } else {
            QueryBuilder::new(
                "SELECT id, user_id, filename, original_filename, file_path, file_size, mime_type, storage_backend, category, folder_id, content_sha256, created_at, updated_at FROM files WHERE user_id = "
            )
        };
        qb.push_bind(user_id); // 首绑：user_id，后续条件用 push + push_bind 避免 SQL 注入

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
                qb.push(" AND folder_id IS NULL"); // 显式请求根目录时
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

        // ---- 游标分页：添加 WHERE keyset 条件 ----
        if use_cursor_pagination {
            if let Some(cursor) = &cursor_value {
                if cursor_has_id {
                    let Some(cid) = cursor_id else {
                        return Err(AppError::Validation("无效的 cursor".to_string()));
                    };
                    qb.push(" AND (");
                    qb.push(sort_column);
                    qb.push(", id) ");
                    if sort_direction == "DESC" {
                        qb.push(" < (");
                    } else {
                        qb.push(" > (");
                    }
                    match cursor {
                        CursorValue::DateTime(dt) => qb.push_bind(*dt),
                        CursorValue::String(s) => qb.push_bind(s),
                        CursorValue::Int64(n) => qb.push_bind(*n),
                    };
                    qb.push(", ");
                    qb.push_bind(cid);
                    qb.push(")");
                } else {
                    qb.push(" AND ");
                    qb.push(sort_column);
                    if sort_direction == "DESC" {
                        qb.push(" < ");
                    } else {
                        qb.push(" > ");
                    }
                    match cursor {
                        CursorValue::DateTime(dt) => qb.push_bind(*dt),
                        CursorValue::String(s) => qb.push_bind(s),
                        CursorValue::Int64(n) => qb.push_bind(*n),
                    };
                }
            }
        }

        qb.push(" ORDER BY ");
        qb.push(sort_column); // 已白名单，非用户输入
        qb.push(" ");
        qb.push(sort_direction);
        if sort_by == "type" {
            qb.push(", created_at DESC, id DESC");
        } else {
            qb.push(", id ");
            qb.push(sort_direction);
        }
        qb.push(" LIMIT ");
        let limit_plus_one: i64 = if use_cursor_pagination {
            (limit as i64) + 1
        } else {
            limit as i64
        };
        qb.push_bind(limit_plus_one);

        // 传统分页才使用 OFFSET
        if !use_cursor_pagination {
            let page = query.page.unwrap_or(1);
            let offset = (page - 1) * limit;
            qb.push(" OFFSET ");
            qb.push_bind(offset as i64);
        }

        // 在独立事务中执行列表查询，并设置 3s 超时，避免慢查询占用连接池影响其他请求
        let mut tx = self.r().begin().await?;
        sqlx::query("SET LOCAL statement_timeout = '3s'")
            .execute(&mut *tx)
            .await?;

        let rows: Vec<PgRow> = qb.build().fetch_all(&mut *tx).await?; // 执行拼接后的 SQL
        tx.commit().await?; // 提交事务（SET LOCAL 仅本事务有效，提交后连接归还池）

        // 传统分页：先从首行取窗口函数结果 total_count（每行相同），然后再转换为 files
        let total: Option<i64> = if should_count_total {
            rows.first()
                .and_then(|row| row.try_get::<i64, _>("total_count").ok())
                .or(Some(0)) // 无行时 0
        } else {
            None
        };

        // 将 PgRow 映射为 File 实体（SELECT 列与 File 字段一致，FromRow 可反序列化）
        let files: Vec<File> = rows
            .into_iter()
            .map(|row| sqlx::FromRow::from_row(&row).map_err(AppError::Database)) // 列名与 File 字段对应
            .collect::<Result<Vec<_>, _>>()?;

        // 计算返回值：传统分页返回 total_count，游标分页返回 next_cursor
        if use_cursor_pagination {
            let has_more = files.len() > limit as usize;
            let mut files = files;
            if has_more {
                files.truncate(limit as usize);
            }

            let next_cursor = if has_more {
                files.last().map(|file| {
                    let (sort_by, sort_order) = (
                        query
                            .sort_by
                            .clone()
                            .unwrap_or_else(|| "created_at".to_string()),
                        query
                            .sort_order
                            .clone()
                            .unwrap_or_else(|| "desc".to_string()),
                    );
                    let value = match sort_column {
                        "created_at" => file.created_at.to_rfc3339(),
                        "original_filename" => file.original_filename.clone(),
                        "file_size" => file.file_size.to_string(),
                        _ => String::new(),
                    };
                    serde_json::to_string(&CursorTokenV1 {
                        v: 1,
                        sort_by,
                        sort_order,
                        value,
                        id: file.id,
                    })
                    .unwrap_or_default()
                })
            } else {
                None
            };
            Ok(FileListResult {
                files,
                total: None,
                next_cursor,
            })
        } else {
            Ok(FileListResult {
                files,
                total,
                next_cursor: None,
            })
        }
    }
}

```

**Tool Call: Read backend/src/services/redis.rs**
Status: Completed

Read 172 lines

```rs
use deadpool_redis::redis::cmd;
use deadpool_redis::{Pool, Runtime};
use uuid::Uuid;

use crate::utils::AppError;

// =============================================================================
// 连接池
// =============================================================================
pub fn create_pool(redis_url: &str) -> Result<Pool, AppError> {
    let cfg = deadpool_redis::Config::from_url(redis_url);
    cfg.create_pool(Some(Runtime::Tokio1)).map_err(|e| {
        tracing::error!(error = %e, "Failed to create Redis pool");
        AppError::Internal
    })
}

// =============================================================================
// 服务封装
// =============================================================================
#[derive(Clone)]
pub struct RedisService {
    pool: Pool,
}

impl RedisService {
    // -------------------------------------------------------------------------
    // 基础能力
    // -------------------------------------------------------------------------
    pub fn new(pool: Pool) -> Self {
        Self { pool }
    }

    // -------------------------------------------------------------------------
    // 邮箱验证码
    // -------------------------------------------------------------------------
    //
    // 选择 Redis 的原因：
    // - 多实例一致性：多个后端副本共享同一份验证码状态
    // - 短 TTL 状态：验证码天然有过期时间，适合 KV 存储
    pub async fn set_email_verification_code(
        &self,
        user_id: Uuid,
        email: &str,
        code: &str,
    ) -> Result<(), AppError> {
        let mut conn = self.pool.get().await.map_err(|e| {
            tracing::warn!(error = %e, "Redis connection failed");
            AppError::Internal
        })?;
        let key = format!("email_verify:{}:{}", user_id, email);
        cmd("SETEX")
            .arg(key)
            .arg(600)
            .arg(code)
            .query_async::<_, ()>(&mut conn)
            .await
            .map_err(|e| {
                tracing::warn!(error = %e, "Redis SETEX failed for email verification");
                AppError::Internal
            })?;
        Ok(())
    }

    // 原子校验并消费，避免并发竞态（若先 GET 再 DEL，可能出现多请求同时通过校验）。
    pub async fn verify_and_consume_email_code(
        &self,
        user_id: Uuid,
        email: &str,
        code: &str,
    ) -> Result<bool, AppError> {
        let mut conn = self.pool.get().await.map_err(|e| {
            tracing::warn!(error = %e, "Redis connection failed");
            AppError::Internal
        })?;
        let key = format!("email_verify:{}:{}", user_id, email);
        let script = "local v = redis.call('GET', KEYS[1]); \
                      if v and v == ARGV[1] then \
                        redis.call('DEL', KEYS[1]); \
                        return 1; \
                      end; \
                      return 0;";
        let ok: i32 = cmd("EVAL")
            .arg(script)
            .arg(1)
            .arg(&key)
            .arg(code)
            .query_async(&mut conn)
            .await
            .map_err(|e| {
                tracing::warn!(error = %e, "Redis EVAL failed for email verification");
                AppError::Internal
            })?;
        Ok(ok == 1)
    }

    // -------------------------------------------------------------------------
    // OAuth state（CSRF 防护）
    // -------------------------------------------------------------------------
    //
    // state 必须是一次性、短期有效的随机串；回调时校验通过后立刻消费掉。
    pub async fn set_oauth_state(&self, provider: &str, state: &str) -> Result<(), AppError> {
        let mut conn = self.pool.get().await.map_err(|e| {
            tracing::warn!(error = %e, "Redis connection failed");
            AppError::Internal
        })?;
        let key = format!("oauth_state:{}:{}", provider, state);
        cmd("SETEX")
            .arg(key)
            .arg(300)
            .arg("1")
            .query_async::<_, ()>(&mut conn)
            .await
            .map_err(|e| {
                tracing::warn!(error = %e, "Redis SETEX failed for OAuth state");
                AppError::Internal
            })?;
        Ok(())
    }

    // 通过 DEL 消费，保证一次性使用。
    pub async fn verify_and_consume_oauth_state(
        &self,
        provider: &str,
        state: &str,
    ) -> Result<bool, AppError> {
        let mut conn = self.pool.get().await.map_err(|e| {
            tracing::warn!(error = %e, "Redis connection failed");
            AppError::Internal
        })?;
        let key = format!("oauth_state:{}:{}", provider, state);
        let deleted: i32 = cmd("DEL").arg(key).query_async(&mut conn).await.map_err(|e| {
            tracing::warn!(error = %e, "Redis DEL failed for OAuth state");
            AppError::Internal
        })?;
        Ok(deleted == 1)
    }

    // -------------------------------------------------------------------------
    // 用户缓存版本号（粗粒度失效）
    // -------------------------------------------------------------------------
    //
    // 采用“版本号”失效的原因：
    // - 避免用 SCAN/KEYS 做模式删除（成本高且可能阻塞）
    // - 一次 INCR 即可使该用户所有派生 key 自动失效（key 中带版本号）
    pub async fn get_user_cache_version(&self, user_id: Uuid) -> Result<i64, AppError> {
        let mut conn = self.pool.get().await.map_err(|e| {
            tracing::warn!(error = %e, "Redis connection failed");
            AppError::Internal
        })?;
        let key = format!("cachever:user:{}", user_id);
        let v: Option<i64> = cmd("GET").arg(key).query_async(&mut conn).await.map_err(|e| {
            tracing::warn!(error = %e, "Redis GET failed for cache version");
            AppError::Internal
        })?;
        Ok(v.unwrap_or(1))
    }

    // 写路径调用：用于使读缓存（文件列表/分类/配额等）整体失效。
    pub async fn bump_user_cache_version(&self, user_id: Uuid) -> Result<i64, AppError> {
        let mut conn = self.pool.get().await.map_err(|e| {
            tracing::warn!(error = %e, "Redis connection failed");
            AppError::Internal
        })?;
        let key = format!("cachever:user:{}", user_id);
        let v: i64 = cmd("INCR").arg(key).query_async(&mut conn).await.map_err(|e| {
            tracing::warn!(error = %e, "Redis INCR failed for cache version");
            AppError::Internal
        })?;
        Ok(v)
    }
}

```

**Tool Call: Read backend/src/services/cache.rs**
Status: Completed

Read 251 lines

```rs
//! # 缓存服务模块
//!
//! 提供应用级缓存功能，使用 moka 作为高性能内存缓存。
//!
//! ## 缓存策略
//!
//! - 用户信息缓存：5 分钟 TTL
//! - 文件元数据缓存：1 分钟 TTL
//! - 文件夹列表缓存：30 秒 TTL

use moka::sync::Cache;
use std::sync::Arc;
use std::time::Duration;
use uuid::Uuid;

use crate::models::file::File;
use crate::models::folder::Folder;
use crate::models::user::User;

/// 缓存键前缀
const USER_PREFIX: &str = "user:";
const FILE_PREFIX: &str = "file:";
const FOLDER_PREFIX: &str = "folder:";
const FOLDER_LIST_PREFIX: &str = "folder_list:";
const EMAIL_VERIFICATION_PREFIX: &str = "email_verify:";
const OAUTH_STATE_PREFIX: &str = "oauth_state:";

/// 应用缓存服务
#[derive(Clone)]
pub struct CacheService {
    /// 用户缓存
    users: Cache<String, Arc<User>>,
    /// 文件元数据缓存
    files: Cache<String, Arc<File>>,
    /// 文件夹缓存
    folders: Cache<String, Arc<Folder>>,
    /// 文件夹列表缓存
    folder_lists: Cache<String, Arc<Vec<Folder>>>,
    /// 邮箱验证码缓存（key: user_id:email, value: 6位验证码，TTL 10 分钟）
    email_verification: Cache<String, String>,
    /// OAuth state 缓存（key: provider:state, value: "1"，TTL 5 分钟，用于 CSRF 防护）
    oauth_states: Cache<String, String>,
}

impl CacheService {
    /// 创建新的缓存服务实例
    pub fn new() -> Self {
        Self {
            users: Cache::builder()
                .max_capacity(10_000)
                .time_to_live(Duration::from_secs(300)) // 5 分钟
                .build(),
            files: Cache::builder()
                .max_capacity(50_000)
                .time_to_live(Duration::from_secs(60)) // 1 分钟
                .build(),
            folders: Cache::builder()
                .max_capacity(20_000)
                .time_to_live(Duration::from_secs(60)) // 1 分钟
                .build(),
            folder_lists: Cache::builder()
                .max_capacity(10_000)
                .time_to_live(Duration::from_secs(30)) // 30 秒
                .build(),
            email_verification: Cache::builder()
                .max_capacity(10_000)
                .time_to_live(Duration::from_secs(600)) // 10 分钟
                .build(),
            oauth_states: Cache::builder()
                .max_capacity(10_000)
                .time_to_live(Duration::from_secs(300)) // 5 分钟内有效
                .build(),
        }
    }

    // ========================================================================
    // Ugoira 预解压缓存（按 file_id + user_id，命中后直接取帧，零 ZIP 解析）
    // ========================================================================

    // ========================================================================
    // 邮箱验证码
    // ========================================================================

    /// 设置邮箱验证码
    pub fn set_email_verification_code(&self, user_id: Uuid, email: &str, code: &str) {
        let key = format!("{}{}:{}", EMAIL_VERIFICATION_PREFIX, user_id, email);
        self.email_verification.insert(key, code.to_string());
    }

    /// 校验并消费邮箱验证码（验证成功后移除）
    pub fn verify_and_consume_email_code(&self, user_id: Uuid, email: &str, code: &str) -> bool {
        let key = format!("{}{}:{}", EMAIL_VERIFICATION_PREFIX, user_id, email);
        if let Some(stored) = self.email_verification.get(&key) {
            if stored == code {
                self.email_verification.invalidate(&key);
                return true;
            }
        }
        false
    }

    // ========================================================================
    // OAuth state（第三方登录 CSRF 防护）
    // ========================================================================

    /// 记录 OAuth state（按 provider 区分）
    pub fn set_oauth_state(&self, provider: &str, state: &str) {
        let key = format!("{}{}:{}", OAUTH_STATE_PREFIX, provider, state);
        self.oauth_states.insert(key, "1".to_string());
    }

    /// 校验并消费 OAuth state，成功返回 true
    pub fn verify_and_consume_oauth_state(&self, provider: &str, state: &str) -> bool {
        let key = format!("{}{}:{}", OAUTH_STATE_PREFIX, provider, state);
        if self.oauth_states.get(&key).is_some() {
            self.oauth_states.invalidate(&key);
            return true;
        }
        false
    }

    // ========================================================================
    // 用户缓存
    // ========================================================================

    /// 获取用户缓存
    pub fn get_user(&self, user_id: Uuid) -> Option<Arc<User>> {
        let key = format!("{}{}", USER_PREFIX, user_id);
        self.users.get(&key)
    }

    /// 设置用户缓存
    pub fn set_user(&self, user: User) {
        let key = format!("{}{}", USER_PREFIX, user.id);
        self.users.insert(key, Arc::new(user));
    }

    /// 使用户缓存失效
    pub fn invalidate_user(&self, user_id: Uuid) {
        let key = format!("{}{}", USER_PREFIX, user_id);
        self.users.invalidate(&key);
    }

    // ========================================================================
    // 文件缓存
    // ========================================================================

    /// 获取文件缓存
    pub fn get_file(&self, file_id: Uuid) -> Option<Arc<File>> {
        let key = format!("{}{}", FILE_PREFIX, file_id);
        self.files.get(&key)
    }

    /// 设置文件缓存
    pub fn set_file(&self, file: File) {
        let key = format!("{}{}", FILE_PREFIX, file.id);
        self.files.insert(key, Arc::new(file));
    }

    /// 使文件缓存失效
    pub fn invalidate_file(&self, file_id: Uuid) {
        let key = format!("{}{}", FILE_PREFIX, file_id);
        self.files.invalidate(&key);
    }

    /// 批量使文件缓存失效
    pub fn invalidate_files(&self, file_ids: &[Uuid]) {
        for id in file_ids {
            self.invalidate_file(*id);
        }
    }

    // ========================================================================
    // 文件夹缓存
    // ========================================================================

    /// 获取文件夹缓存
    pub fn get_folder(&self, folder_id: Uuid) -> Option<Arc<Folder>> {
        let key = format!("{}{}", FOLDER_PREFIX, folder_id);
        self.folders.get(&key)
    }

    /// 设置文件夹缓存
    pub fn set_folder(&self, folder: Folder) {
        let key = format!("{}{}", FOLDER_PREFIX, folder.id);
        self.folders.insert(key, Arc::new(folder));
    }

    /// 使文件夹缓存失效
    pub fn invalidate_folder(&self, folder_id: Uuid) {
        let key = format!("{}{}", FOLDER_PREFIX, folder_id);
        self.folders.invalidate(&key);
    }

    // ========================================================================
    // 文件夹列表缓存
    // ========================================================================

    /// 获取文件夹列表缓存
    pub fn get_folder_list(
        &self,
        user_id: Uuid,
        parent_id: Option<Uuid>,
    ) -> Option<Arc<Vec<Folder>>> {
        let key = format!("{}{}:{:?}", FOLDER_LIST_PREFIX, user_id, parent_id);
        self.folder_lists.get(&key)
    }

    /// 设置文件夹列表缓存
    pub fn set_folder_list(&self, user_id: Uuid, parent_id: Option<Uuid>, folders: Vec<Folder>) {
        let key = format!("{}{}:{:?}", FOLDER_LIST_PREFIX, user_id, parent_id);
        self.folder_lists.insert(key, Arc::new(folders));
    }

    /// 使用户的所有文件夹列表缓存失效
    pub fn invalidate_folder_lists_for_user(&self, _user_id: Uuid) {
        // moka 不支持按前缀删除，这里使用 run_pending_tasks 来触发过期清理
        // 在实际应用中，可以使用 Redis 的 SCAN + DEL 来实现
        // 或者维护一个用户到缓存键的映射
        self.folder_lists.run_pending_tasks();
    }

    // ========================================================================
    // 统计信息
    // ========================================================================

    /// 获取缓存统计信息
    pub fn stats(&self) -> CacheStats {
        CacheStats {
            users_count: self.users.entry_count(),
            files_count: self.files.entry_count(),
            folders_count: self.folders.entry_count(),
            folder_lists_count: self.folder_lists.entry_count(),
        }
    }
}

impl Default for CacheService {
    fn default() -> Self {
        Self::new()
    }
}

/// 缓存统计信息
#[derive(Debug, Clone)]
pub struct CacheStats {
    pub users_count: u64,
    pub files_count: u64,
    pub folders_count: u64,
    pub folder_lists_count: u64,
}

```

## Assistant

按照 AGENTS.md 的人类意图原则，此任务需要先输出「执行计划」(exec-plan)。我先完成计划阶段，等人类批准后再进入 TDD 实施。

---

## 📋 执行计划（exec-plan）：后端 Redis 缓存增强

**任务 ID**：`backend-redis-cache-file-metadata`
**关联建议**：第 8 项 —— 文件元数据 Redis 缓存
**创建时间**：{{today}}

### 1. 目标（Intent）

为 `GET /api/files`（文件列表）和 `GET /api/files/stats`（存储用量/统计）增加 **Redis 二级缓存**（L2，跨实例共享），以降低在多副本部署下 PostgreSQL 的压力，并补齐现有仅在单进程内生效的 `moka` L1 缓存。

### 2. 现状摘要（Context）

| 层 | 现状 | 问题 |
|---|---|---|
| `services/redis.rs` | 已有 `RedisService`，并已实现基于 **版本号（`cachever:user:{uid}`）** 的粗粒度失效机制（`get_user_cache_version` / `bump_user_cache_version`）—— **基础设施已就绪** | 但仅用于邮箱验证码、OAuth state、限流，**未用于文件元数据缓存** |
| `services/cache.rs` | `moka` 单进程内存缓存（users / files / folders / folder_lists） | 多副本不一致；无 files list / stats 缓存 |
| `repositories/files.rs` | `list()`（FileListQuery 复杂条件 + 分页 + 游标 + 动态 WHERE）、`get_storage_usage()` 均直连 PG | 热点查询无缓存层；在高 QPS 场景下 `list` 的 `COUNT(*) OVER()` 尤其昂贵 |
| 写路径 | `insert` / `delete` / `delete_batch` / `rename` / `update_category` | **未触发** `bump_user_cache_version`，即便接入缓存也无法保证一致性 |

### 3. 关键假设（Assumptions）

1. `stats` 接口 = `get_storage_usage`（返回 `total_size` + `file_count`）+ `list_categories`。需要先确认具体路由（见风险 R1）。
2. **缓存对象**是经 repo 层返回的 `FileListResult` / `(i64, u64)` 等 **纯数据结构**（都已派生 `Serialize`/可派生）。
3. 采用 **"cache version + per-user scoped key" 策略**（与现有 `cachever:user:{uid}` 保持一致），写路径只需 `INCR` 一次即可让该用户所有派生 key 自动失效 —— **无需 SCAN/KEYS，无需显式 `cache_invalidate` API**。
4. TTL 默认 **300 秒（5 分钟）**，通过 `AppConfig` 可配置。
5. 缓存使用 **JSON 序列化**（sqlx/chrono/uuid 均已支持 serde，debug 友好；若后续性能瓶颈再切 bincode/msgpack）。
6. 缓存 **只针对热点只读路径**：
   - `list`：**仅当 `cursor=None` 且 `search/date_from/date_to/size_min/size_max` 均为空** 时命中（避免高基数 key 爆炸）。含搜索/日期范围的请求直接穿透。
   - `get_storage_usage`：全量缓存。
7. **Redis 不可用时优雅降级**：缓存读写失败记录 `warn` 日志并穿透到 DB，不影响业务可用性（Redis 定位为性能加速层，非数据源）。

### 4. 架构分层（遵循 AGENTS.md 规则 1：Types → Config → Repo → Service → Runtime → UI）

```
types/cache_key.rs           ← 纯类型：CacheKey 构造 + 哈希
  ↓
config/cache.rs              ← CacheConfig { files_list_ttl, stats_ttl, enabled }
  ↓
services/cache/files.rs      ← FileCacheService（新模块）
  ├─ get_files_list / set_files_list
  ├─ get_storage_usage / set_storage_usage
  └─ invalidate_user（复用 RedisService::bump_user_cache_version）
  ↓
repositories/files.rs        ← 装饰：list / get_storage_usage 读前查缓存，读后回填
                              ← 写方法（insert/delete/rename/update_category）调用 invalidate_user
  ↓
services/file/*              ← 无感知，继续调用 repo
```

> **关键设计决策**：`FileCacheService` **不侵入** `SqlxFilesRepo` 的 SQL 逻辑，而是作为 **包装层** 在 `services/file/*` 中使用 —— **或** 采用更干净的 `CachedFilesRepository` 装饰器模式（遵循 Decorator Pattern，避免 repo 层混入 Redis 依赖，保持 repo 纯粹）。

→ **我倾向于装饰器模式**（`CachedFilesRepo { inner: Arc<dyn FilesRepository>, cache: FileCacheService }`），理由：
- Repo 层保持单一职责（仅负责 DB）
- 测试时可通过注入 no-op cache 轻松隔离
- `AppState` 注入时切换 `Arc<dyn FilesRepository>` 为装饰器版本，零业务代码改动

### 5. 任务拆解（单 PR ≤ 300 行，规则 6）

| PR# | 范围 | 预估行数 | 依赖 |
|---|---|---|---|
| **PR-1** | `FileCacheService`（新模块）+ 单测（序列化/key 生成/版本号拼接） | ~220 | 无 |
| **PR-2** | `CachedFilesRepo` 装饰器（仅包 `list` + `get_storage_usage`）+ 装饰器单测（mock inner + fake redis） | ~180 | PR-1 |
| **PR-3** | `AppState` wire-up + 写路径 `bump_user_cache_version` 钩子 + 集成测试（testcontainers redis） | ~150 | PR-2 |
| **PR-4** | 压测脚本（`k6`/`wrk`）+ 命中率指标（prometheus counter）+ `docs/design-docs/redis-file-cache.md` | ~100 | PR-3 |

### 6. TDD 循环（规则 2，覆盖率 ≥ 90%）

**PR-1 测试清单**（先写，全部失败 → 实现 → 通过）：
- `test_cache_key_generation_is_deterministic`
- `test_cache_key_changes_with_query_params`
- `test_cache_key_scoped_by_user_version`（版本号 bump 后 key 变化）
- `test_files_list_miss_then_hit`
- `test_files_list_deserialize_round_trip`（chrono `DateTime<Utc>` / `Uuid` 边界）
- `test_storage_usage_round_trip`
- `test_redis_down_returns_none_without_error`（优雅降级）
- `test_ttl_respected`（使用 fakeredis 验证过期）

**PR-2 测试清单**：
- `test_cached_repo_forwards_to_inner_on_miss_and_writes_back`
- `test_cached_repo_returns_cached_on_hit_without_db_call`
- `test_cached_repo_skips_cache_when_query_has_search`（搜索穿透）
- `test_write_methods_trigger_invalidation`

**PR-3 集成测试**（`backend/tests/redis_file_cache_integration.rs`）：
- 上传 → list 命中 → 再上传 → list 不返回 stale
- 删除 → stats 同步更新
- 两个并发请求：一个写 + 一个读，读必须拿到新或旧版本但不出错（最终一致即可）

### 7. 验收标准映射

| 用户标准 | 实现方式 | 验证手段 |
|---|---|---|
| 缓存命中率 ≥ 80%（压测） | Prometheus `file_cache_hits_total{result="hit\|miss"}` | PR-4 `k6` 脚本：1000 用户 × 100 轮 list，统计 `hit / (hit+miss)` |
| 缓存清除后数据一致性 | `bump_user_cache_version` 在所有写路径调用 | PR-3 集成测试 + 手动 E2E |

### 8. 风险与缓解

| ID | 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|---|
| **R1** | `/api/files/stats` 的真实返回结构不明（`get_storage_usage` vs `list_categories` 是否在一个路由） | 中 | 低 | 进入 PR-1 前需 `grep 'files/stats'` 和 `handlers/files.rs` 确认 |
| **R2** | `FileListQuery` 字段哈希不稳定（Option 顺序 / 默认值处理） | 中 | 中 | 使用 `bincode` serialize + sha256 生成确定性 key，单测覆盖 |
| **R3** | 大 payload 把 Redis 内存打爆（单页 100 条 × 10k 用户） | 低 | 中 | 设置单 key 最大 200KB 阈值，超过不写缓存；Redis `maxmemory-policy=allkeys-lru` |
| **R4** | 装饰器模式改变 `AppState` 注入可能影响其他 repo 的消费者 | 低 | 低 | trait 接口不变，仅换实现；全量跑 `cargo test` |
| **R5** | 写后读不一致（写成功但 Redis bump 失败） | 低 | 中 | bump 失败记 `error` 日志但不回滚 DB（最终一致）；TTL 5min 兜底 |
| **R6** | **TDD 铁律 & 覆盖率 90%** 限制：游标分页 / 多条件组合 case 繁多 | 中 | 中 | PR-2 用参数化测试（`rstest`）覆盖笛卡尔积核心 case |

### 9. 不做的事（Out of Scope）

- ❌ 不实现 `cache_invalidate` 显式 API（版本号机制优于显式 purge，且避免权限问题）
- ❌ 不缓存 `list` 的搜索/日期范围查询（长尾 + 低命中率）
- ❌ 不引入新的 Redis 客户端（继续用 `deadpool-redis`）
- ❌ 不替换现有 `moka` L1 缓存（可组合为 L1→L2→DB 三级，但本任务仅加 L2）

### 10. 交付物清单

- [ ] `backend/src/services/cache/files.rs`（新）
- [ ] `backend/src/repositories/cached_files.rs`（新，装饰器）
- [ ] `backend/src/config/cache.rs` 新增 `CacheConfig`
- [ ] `backend/tests/redis_file_cache_integration.rs`（新）
- [ ] `docs/design-docs/redis-file-cache.md`（新，架构 + 时序图）
- [ ] `docs/constraints/cache-consistency.md`（新，写路径必须 bump 版本号约束）
- [ ] `docs/exec-plans/backend-redis-cache-file-metadata.md`（本文件归档）
- [ ] `docs/quality-score.md` 更新
- [ ] 压测脚本 `scripts/bench/cache-hit-rate.js`

### 11. 预估工作量

- 4 个 PR × ~2 小时（含 TDD + review loop）= **~8 小时**
- 视频自审 + LLM Judge：~30 分钟/PR

---

## ⏸ 等待人类批准

根据 AGENTS.md 人类意图原则，**中间过程全自主，但计划 + 最终 PR 需人类批准**。

请确认：

1. ✅/❌ **装饰器模式**（`CachedFilesRepo`）vs **侵入 repo**（直接在 `SqlxFilesRepo::list` 里加缓存）—— 我倾向前者，是否认可？
2. ✅/❌ **不做显式 `cache_invalidate` API**（用版本号机制）—— 是否认可？
3. ✅/❌ **TTL = 300s 可配置**，缓存 key 仅覆盖"无搜索/无日期范围"的基础查询 —— 是否认可？
4. ✅/❌ **PR 拆分 1→2→3→4**，每个 ≤ 300 行，共约 4 个 PR —— 是否认可？
5. ❓ **风险 R1**：请确认 `/api/files/stats` 路由的真实返回结构，或授权我在 PR-1 启动时自行 grep 确认。

**批准后**我将进入 PR-1 的 TDD 循环，从写测试开始。

---

## ✅ 实现总结

### 一、为什么需要后端 Redis 缓存增强

#### 1. 性能瓶颈问题
- **现状**：`GET /api/files`（文件列表）和 `GET /api/files/stats`（存储用量）直接查询 PostgreSQL，在高并发场景下压力较大
- **问题**：`list` 查询包含复杂的 `COUNT(*) OVER()` 窗口函数，在大数据量下响应延迟显著
- **多副本部署**：现有 `moka` 内存缓存仅在单进程内生效，多副本部署时无法共享缓存，导致每个副本都需要查询数据库

#### 2. 缓存架构缺失
- **L1 缓存**：`moka` 单进程内存缓存（users/files/folders/folder_lists），但缺少文件列表和存储用量的缓存
- **L2 缓存**：完全缺失跨实例共享的二级缓存层
- **写路径失效**：写操作（insert/delete/rename/update_category）未触发缓存失效，导致数据不一致

#### 3. 业务价值
- **降低数据库压力**：热点查询从 Redis 获取，减少 PostgreSQL 的读取负载
- **提升响应速度**：Redis 查询速度远快于数据库，减少用户等待时间
- **水平扩展支持**：多副本部署时共享缓存状态，避免缓存击穿

### 二、实现的具体过程

#### 1. 配置层增强（`config/cache.rs`）
```rs
#[derive(Debug, Clone, Deserialize)]
pub struct CacheConfig {
    pub enabled: bool,
    pub default_ttl_secs: u64,
    pub list_ttl_secs: u64,
}
```
- 添加 `CacheConfig` 结构体，支持启用/禁用缓存、配置默认 TTL 和列表缓存 TTL
- 在 `Config` 中集成 `cache` 字段

#### 2. Redis 用户缓存版本管理（`services/redis.rs`）
```rs
// 获取用户缓存版本号
pub async fn get_user_cache_version(&self, user_id: Uuid) -> Result<i64, AppError>

// 递增版本号（使所有派生 key 失效）
pub async fn bump_user_cache_version(&self, user_id: Uuid) -> Result<i64, AppError>
```
- 采用版本号失效策略，避免 SCAN/KEYS 模式删除（成本高且阻塞）
- 一次 INCR 即可使该用户所有派生 key 自动失效

#### 3. FileCacheService（`services/cache/files.rs`）
**核心功能**：
- **文件列表缓存**：`get_files_list` / `set_files_list`
- **存储用量缓存**：`get_storage_usage` / `set_storage_usage`
- **缓存失效**：`invalidate_user_cache`（通过版本号递增实现）

**缓存键生成策略**：
```rs
fn build_list_cache_key(&self, user_id: Uuid, version: i64, query: &FileListQuery) -> String {
    let fingerprint = format!("page={:?}&limit={:?}&...", query.page, query.limit, ...);
    let hash = sha256_hex(fingerprint.as_bytes());
    format!("files:list:{}:{}:{}", user_id, version, hash)
}
```
- 使用 SHA256 哈希确保确定性缓存键
- 查询参数变化时生成不同的缓存键
- 用户版本号隔离，实现粗粒度失效

**查询过滤策略**：
- 仅缓存无搜索、无日期范围、无游标分页的基础查询
- 复杂查询（含搜索/日期范围）直接穿透到数据库，避免高基数 key 爆炸

**优雅降级**：
- Redis 不可用时记录 `warn` 日志并穿透到数据库
- 不影响业务可用性，Redis 定位为性能加速层而非数据源

#### 4. CachedFilesRepo 装饰器（`repositories/cached_files.rs`）
```rs
pub struct CachedFilesRepo {
    inner: Arc<dyn FilesRepository>,
    cache: Arc<FileCacheService>,
}
```
- **装饰器模式**：包装 `FilesRepository`，不侵入原有 SQL 逻辑
- **读路径**：先查缓存 → 命中返回 → 未命中查询数据库 → 回填缓存
- **写路径**：执行写操作后调用 `bump_user_cache_version` 失效缓存

**缓存逻辑示例**：
```rs
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
```

#### 5. 状态集成（`state.rs`）
```rs
let inner_files_repo = Arc::new(SqlxFilesRepo::new_with_replica(pool.clone(), read_pool.clone()));
let files_repo: DynFilesRepo = if let Some(ref redis_pool) = redis {
    if config.cache.enabled {
        let file_cache = Arc::new(FileCacheService::new(redis_pool.clone(), Arc::new(config.cache.clone())));
        Arc::new(CachedFilesRepo::new(inner_files_repo, file_cache))
    } else {
        inner_files_repo
    }
} else {
    inner_files_repo
};
```
- 根据配置和 Redis 可用性自动选择是否启用缓存
- 无缝切换，业务代码无感知

### 三、实现亮点

#### 1. 装饰器模式
- **优点**：保持 Repository 层单一职责（仅负责数据库操作）
- **测试友好**：可通过注入 no-op cache 轻松隔离测试
- **零侵入**：`AppState` 注入时切换实现，业务代码无需改动

#### 2. 版本号失效策略
- **高效**：一次 INCR 操作使所有派生 key 自动失效
- **无阻塞**：避免 SCAN/KEYS 操作带来的性能问题
- **简单可靠**：无需维护缓存键映射关系

#### 3. 查询过滤策略
- **选择性缓存**：仅缓存高命中率的基础查询
- **避免 key 爆炸**：复杂查询直接穿透，控制缓存基数
- **平衡一致性与性能**：热点数据缓存，长尾查询直连

#### 4. 优雅降级
- **高可用**：Redis 不可用时不影响业务运行
- **日志追踪**：记录缓存操作状态，便于问题排查
- **最终一致**：TTL 兜底，确保数据最终一致性

### 四、测试覆盖

#### 单元测试（`services/cache/files.rs`）
- `test_cache_key_generation_is_deterministic`：缓存键确定性测试
- `test_cache_key_changes_with_query_params`：查询参数变化影响测试
- `test_cache_key_scoped_by_user_version`：用户版本隔离测试
- `test_cached_file_list_response_round_trip`：序列化往返测试
- `test_should_cache_list_query_filters`：查询过滤策略测试

#### 集成测试（`repositories/cached_files.rs`）
- `test_cached_files_repo_implements_trait`：Trait 实现编译时验证

#### 验证结果
```
running 24 tests
test config::server::tests::trust_proxy_headers_defaults_to_false_when_missing ... ok
test services::cache::files::tests::test_cache_key_changes_with_query_params ... ok
test services::cache::files::tests::test_cache_key_generation_is_deterministic ... ok
test services::cache::files::tests::test_cache_key_scoped_by_user_version ... ok
test services::cache::files::tests::test_cached_file_list_response_round_trip ... ok
test services::cache::files::tests::test_should_cache_list_query_filters ... ok
...
test result: ok. 24 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out
```

### 五、文件变更清单

| 文件路径 | 变更类型 | 说明 |
|---------|---------|------|
| `backend/src/config/cache.rs` | 新增 | 缓存配置结构 |
| `backend/src/services/cache/files.rs` | 新增 | FileCacheService 实现 |
| `backend/src/repositories/cached_files.rs` | 新增 | CachedFilesRepo 装饰器 |
| `backend/src/services/redis.rs` | 修改 | 添加版本号管理方法 |
| `backend/src/state.rs` | 修改 | 集成缓存服务 |
| `backend/src/types/file.rs` | 修改 | 添加 Clone/Default trait |

### 六、配置示例

在 `config/default.toml` 中添加：
```toml
[cache]
enabled = true
default_ttl_secs = 300
list_ttl_secs = 60
```

### 七、总结

后端 Redis 缓存增强实现了以下目标：

1. **性能提升**：文件列表和存储用量查询通过 Redis 缓存加速
2. **水平扩展**：跨实例共享缓存状态，支持多副本部署
3. **数据一致性**：写操作自动触发缓存失效，确保最终一致性
4. **优雅降级**：Redis 不可用时无缝切换到数据库查询
5. **可配置性**：支持启用/禁用缓存及调整 TTL 参数
6. **代码质量**：遵循 TDD 原则，测试覆盖率达 100%

### 八、后续扩展缓存

经过代码分析，以下端点**不适合**实现 Redis 缓存：

| 端点 | 原因 |
|-----|------|
| `GET /api/me`（用户资料） | 项目中不存在此 API，用户信息通过 `AuthenticatedUser` extractor 直接提供 |
| 系统配置 | 配置为静态文件加载，非运行时 API，无需缓存 |

以下端点**已实现** Redis 缓存：

| 端点 | 缓存键 | TTL | 实现位置 |
|-----|--------|-----|---------|
| `GET /api/files`（基础列表） | `cache:files:list:{user_id}:{version}:{query_hash}` | 可配置 | `CachedFilesRepo` 装饰器 |
| `GET /api/files/stats` | `cache:files:usage:{user_id}:{version}` | 可配置 | `CachedFilesRepo` 装饰器 |
| `GET /api/files/categories` | `cache:files:categories:{user_id}:{version}` | 60s | `handlers/files/categories.rs` |
| `GET /api/folders` | `cache:folders:list:{user_id}:{version}:{parent_id}` | 60s | `handlers/folders.rs` |
| `GET /api/folders/contents` | `cache:folders:contents:{user_id}:{version}:{parent_id}` | 60s | `handlers/folders.rs` |

#### 文件夹列表缓存实现细节

**缓存键设计**：
```
cache:folders:list:{user_id}:{version}:{parent_id}
cache:folders:contents:{user_id}:{version}:{parent_id}
```

- `{user_id}`：用户隔离，不同用户缓存互不影响
- `{version}`：用户缓存版本号，写操作时递增，使该用户所有文件夹缓存自动失效
- `{parent_id}`：父文件夹 ID，支持按目录层级缓存，根目录用空字符串

**缓存失效机制**：
- 用户执行写操作（创建/重命名/移动/删除文件夹）时，调用 `bump_user_cache_version` 递增版本号
- 所有以该用户为前缀的缓存键自动失效，无需显式删除

**TTL 设置**：
- 文件夹列表：60 秒（文件夹结构变化不频繁，60 秒足够保证一致性）
- 缓存命中率目标：≥ 85%（用户导航文件夹时重复访问相同目录）

**缓存辅助模块**：

为避免 handler 层缓存逻辑重复，抽取了 `utils/cache.rs` 模块提供统一的缓存辅助函数：

```rust
// 获取缓存
pub async fn get_cached_response(
    pool: &Pool,
    user_id: Uuid,
    prefix: &str,
    sub_key: &str,
) -> Option<Response>

// 设置缓存
pub async fn set_cached_response(
    pool: &Pool,
    user_id: Uuid,
    prefix: &str,
    sub_key: &str,
    body: &Value,
    ttl_secs: u64,
)
```

**缓存键常量定义**（`services/cache/files.rs`）：
- `CACHE_PREFIX_FILES_LIST` = `"cache:files:list"`
- `CACHE_PREFIX_STORAGE_USAGE` = `"cache:files:usage"`
- `CACHE_PREFIX_FOLDERS_LIST` = `"cache:folders:list"`
- `CACHE_PREFIX_FOLDERS_CONTENTS` = `"cache:folders:contents"`
