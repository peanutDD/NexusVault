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
//! ## 架构设计
//!
//! ```text
//! ┌─────────────┐
//! │  Handlers   │
//! └──────┬──────┘
//!        │
//! ┌──────▼──────┐
//! │ FileService │  ← 业务逻辑层
//! └──────┬──────┘
//!        │
//! ┌──────▼──────┐     ┌────────────┐
//! │  Database   │────→│  Storage   │
//! │   (SQLx)    │     │ (Local/S3) │
//! └─────────────┘     └────────────┘
//! ```
//!
//! ## 使用示例
//!
//! ```rust,ignore
//! let service = FileService::new(pool, storage, config);
//!
//! // 上传文件
//! let file = service.create_file(user_id, filename, mime, size, data).await?;
//!
//! // 列出文件
//! let (files, total) = service.list_files(user_id, query).await?;
//! ```

use chrono::Utc;
use sqlx::PgPool;
use std::path::Path;
use std::sync::Arc;
use uuid::Uuid;

use crate::{
    config::Config,
    models::file::{BatchMoveRequest, File, FileListQuery, FileResponse},
    models::upload_session::{
        CompleteChunkedUploadRequest, InitChunkedUploadRequest, UploadSession,
    },
    services::storage::{LocalStorage, S3Storage, StorageBackend},
    utils::AppError,
};

/// 分块上传的块大小（5 MiB）
pub const CHUNK_SIZE: u32 = 5 * 1024 * 1024;

pub struct FileService {
    pool: PgPool,
    storage: Arc<dyn StorageBackend>,
    config: Arc<Config>,
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

    pub async fn create_file(
        &self,
        user_id: Uuid,
        original_filename: String,
        mime_type: String,
        file_size: u64,
        data: Vec<u8>,
    ) -> Result<FileResponse, AppError> {
        // Validate file size
        crate::utils::validate_file_size(file_size, self.config.max_file_size)?;

        // Check storage quota（使用 query_scalar + flatten 简化嵌套 Option）
        let (current_usage, _) = self.get_storage_usage(user_id).await?;
        let quota = sqlx::query_scalar::<_, Option<i64>>("SELECT storage_quota FROM users WHERE id = $1")
            .bind(user_id)
            .fetch_optional(&self.pool)
            .await?
            .flatten();

        if let Some(quota) = quota {
            if current_usage + file_size as i64 > quota {
                return Err(AppError::Validation(format!(
                    "存储配额不足。已使用: {} MB, 配额: {} MB, 需要: {} MB",
                    (current_usage as f64 / 1_048_576.0).round() as i64,
                    (quota as f64 / 1_048_576.0).round() as i64,
                    (file_size as f64 / 1_048_576.0).round() as i64,
                )));
            }
        }

        // Validate mime type
        crate::utils::validate_mime_type(&mime_type, &self.config.allowed_mime_types)?;

        // Sanitize filename
        let sanitized_filename = crate::utils::validation::sanitize_filename(&original_filename)?;
        let file_id = Uuid::new_v4();
        let storage_filename = format!("{}_{}", file_id, sanitized_filename);

        // Save file to storage
        let file_path = self
            .storage
            .save_file(user_id, file_id, &storage_filename, &data)
            .await?;

        // Save file metadata to database
        let file = sqlx::query_as::<_, File>(
            "INSERT INTO files (id, user_id, filename, original_filename, file_path, file_size, mime_type, storage_backend) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *",
        )
        .bind(file_id)
        .bind(user_id)
        .bind(&storage_filename)
        .bind(&original_filename)
        .bind(&file_path)
        .bind(file_size as i64)
        .bind(&mime_type)
        .bind(&self.config.storage_backend)
        .fetch_one(&self.pool)
        .await?;

        Ok(FileResponse::from(file))
    }

    pub async fn list_files(
        &self,
        user_id: Uuid,
        query: FileListQuery,
    ) -> Result<(Vec<FileResponse>, u64), AppError> {
        use chrono::{DateTime, NaiveDateTime, Utc};

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
        let mime_type_filter: Option<String> = query.mime_type.as_deref().filter(|s| !s.is_empty()).map(|s| {
            if s.ends_with('/') {
                format!("{}%", s) // Prefix match: "image/" -> "image/%"
            } else {
                s.to_string() // Exact match: "application/pdf"
            }
        });
        let mime_type_is_prefix = query.mime_type.as_deref().map(|s| s.ends_with('/')).unwrap_or(false);
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
            conditions
                .push("(category IS NULL OR category = '' OR TRIM(category) = '')".to_string());
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

        // Build query with dynamic WHERE clause. SELECT 需包含 File 全部字段，否则 FromRow 报 no column file_path
        let query_sql = format!(
            "SELECT id, user_id, filename, original_filename, file_path, file_size, mime_type, storage_backend, category, folder_id, created_at, updated_at FROM files {} ORDER BY created_at DESC LIMIT ${} OFFSET ${}",
            where_clause,
            param_index,
            param_index + 1
        );
        let count_sql = format!("SELECT COUNT(*) FROM files {}", where_clause);

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

        let rows = query_builder.fetch_all(&self.pool).await?;
        let files: Vec<File> = rows
            .into_iter()
            .map(|row| sqlx::FromRow::from_row(&row).map_err(AppError::Database))
            .collect::<Result<Vec<_>, _>>()?;

        // Build count query with bindings (using query_scalar for dynamic SQL)
        let mut count_builder = sqlx::query_scalar::<_, i64>(&count_sql);
        count_builder = count_builder.bind(user_id);

        if let Some(ref cat) = category_filter_exact {
            count_builder = count_builder.bind(cat);
        }

        // Bind folder_id if specified and not null
        if let Some(Some(fid)) = &folder_id_filter {
            count_builder = count_builder.bind(*fid);
        }

        if let Some(ref search_pattern) = search_pattern {
            count_builder = count_builder.bind(search_pattern);
        }

        if let Some(ref mime_type) = mime_type_filter {
            count_builder = count_builder.bind(mime_type);
        }

        if let Some(df) = date_from {
            count_builder = count_builder.bind(df);
        }

        if let Some(dt) = date_to {
            count_builder = count_builder.bind(dt);
        }

        if let Some(size_min) = query.size_min {
            count_builder = count_builder.bind(size_min);
        }

        if let Some(size_max) = query.size_max {
            count_builder = count_builder.bind(size_max);
        }

        let total: i64 = count_builder.fetch_one(&self.pool).await?;

        let responses: Vec<FileResponse> = files.into_iter().map(FileResponse::from).collect();
        Ok((responses, total as u64))
    }

    pub async fn get_file(&self, file_id: Uuid, user_id: Uuid) -> Result<File, AppError> {
        let file = sqlx::query_as::<_, File>("SELECT * FROM files WHERE id = $1 AND user_id = $2")
            .bind(file_id)
            .bind(user_id)
            .fetch_optional(&self.pool)
            .await?
            .ok_or(AppError::NotFound)?;

        Ok(file)
    }

    pub async fn get_file_data(&self, file: &File) -> Result<Vec<u8>, AppError> {
        self.storage.get_file(&file.file_path).await
    }

    pub async fn delete_file(&self, file_id: Uuid, user_id: Uuid) -> Result<(), AppError> {
        let file = self.get_file(file_id, user_id).await?;
        self.storage.delete_file(&file.file_path).await?;
        sqlx::query("DELETE FROM files WHERE id = $1 AND user_id = $2")
            .bind(file_id)
            .bind(user_id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn batch_delete(&self, ids: &[Uuid], user_id: Uuid) -> Result<u64, AppError> {
        let mut deleted = 0u64;
        for &id in ids {
            if let Ok(file) = self.get_file(id, user_id).await {
                self.storage.delete_file(&file.file_path).await?;
                sqlx::query("DELETE FROM files WHERE id = $1 AND user_id = $2")
                    .bind(id)
                    .bind(user_id)
                    .execute(&self.pool)
                    .await?;
                deleted += 1;
            }
        }
        Ok(deleted)
    }

    pub async fn batch_download_zip(
        &self,
        ids: &[Uuid],
        user_id: Uuid,
    ) -> Result<Vec<u8>, AppError> {
        use std::io::Write;
        use zip::write::ZipWriter;
        use zip::CompressionMethod;

        let mut buf = Vec::new();
        let mut zip = ZipWriter::new(std::io::Cursor::new(&mut buf));

        for &id in ids {
            if let Ok(file) = self.get_file(id, user_id).await {
                let data = self.get_file_data(&file).await?;
                let options: zip::write::FileOptions<()> = zip::write::FileOptions::default()
                    .compression_method(CompressionMethod::Deflated);
                zip.start_file(&file.original_filename, options)
                    .map_err(|e| AppError::File(format!("Failed to add file to zip: {}", e)))?;
                zip.write_all(&data)
                    .map_err(|e| AppError::File(format!("Failed to write file to zip: {}", e)))?;
            }
        }

        zip.finish()
            .map_err(|e| AppError::File(format!("Failed to finalize zip: {}", e)))?;

        Ok(buf)
    }

    pub async fn get_storage_usage(&self, user_id: Uuid) -> Result<(i64, u64), AppError> {
        // Get total storage used and file count
        // CAST SUM to BIGINT because PostgreSQL SUM() returns NUMERIC
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

    pub async fn get_storage_quota(&self, user_id: Uuid) -> Result<Option<i64>, AppError> {
        let result: Option<(Option<i64>,)> =
            sqlx::query_as("SELECT storage_quota FROM users WHERE id = $1")
                .bind(user_id)
                .fetch_optional(&self.pool)
                .await?;

        Ok(result.and_then(|(quota,)| quota))
    }

    /// List distinct categories for a user (excluding null/empty).
    pub async fn list_categories(&self, user_id: Uuid) -> Result<Vec<String>, AppError> {
        let rows = sqlx::query_scalar::<_, String>(
            "SELECT DISTINCT category FROM files WHERE user_id = $1 AND category IS NOT NULL AND TRIM(category) != '' ORDER BY category",
        )
        .bind(user_id)
        .fetch_all(&self.pool)
        .await?;

        Ok(rows)
    }

    /// Batch move files to a category. Empty category = uncategorized (NULL).
    pub async fn batch_move(&self, user_id: Uuid, req: BatchMoveRequest) -> Result<u64, AppError> {
        let category_value: Option<String> = req.category.as_ref().and_then(|s| {
            let t = s.trim();
            if t.is_empty() {
                None
            } else {
                Some(t.to_string())
            }
        });

        let result = sqlx::query(
            "UPDATE files SET category = $1, updated_at = $2 WHERE user_id = $3 AND id = ANY($4)",
        )
        .bind(&category_value)
        .bind(Utc::now())
        .bind(user_id)
        .bind(&req.ids)
        .execute(&self.pool)
        .await?;

        Ok(result.rows_affected())
    }

    fn chunked_temp_dir(&self, upload_id: Uuid) -> std::path::PathBuf {
        Path::new(&self.config.storage_path)
            .join(".chunked")
            .join(upload_id.to_string())
    }

    pub async fn init_chunked_upload(
        &self,
        user_id: Uuid,
        req: InitChunkedUploadRequest,
    ) -> Result<(Uuid, u32, u32), AppError> {
        crate::utils::validate_file_size(req.total_size, self.config.max_file_size)?;
        crate::utils::validate_mime_type(&req.mime_type, &self.config.allowed_mime_types)?;
        let (current_usage, _) = self.get_storage_usage(user_id).await?;
        if let Some(quota) = self.get_storage_quota(user_id).await? {
            if current_usage + req.total_size as i64 > quota {
                return Err(AppError::Validation("存储配额不足".to_string()));
            }
        }

        let upload_id = Uuid::new_v4();
        let total_parts = req.total_size.div_ceil(CHUNK_SIZE as u64) as u32;
        let temp_path = self.chunked_temp_dir(upload_id);
        tokio::fs::create_dir_all(&temp_path)
            .await
            .map_err(|e| AppError::Storage(format!("Failed to create temp dir: {}", e)))?;

        let path_str = temp_path.to_string_lossy().to_string();
        let expires = Utc::now() + chrono::Duration::hours(24);
        sqlx::query(
            "INSERT INTO upload_sessions (id, user_id, filename, mime_type, total_size, chunk_size, temp_path, expires_at) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
        )
        .bind(upload_id)
        .bind(user_id)
        .bind(&req.filename)
        .bind(&req.mime_type)
        .bind(req.total_size as i64)
        .bind(CHUNK_SIZE as i32)
        .bind(&path_str)
        .bind(expires)
        .execute(&self.pool)
        .await?;

        Ok((upload_id, CHUNK_SIZE, total_parts))
    }

    pub async fn get_upload_session(
        &self,
        upload_id: Uuid,
        user_id: Uuid,
    ) -> Result<UploadSession, AppError> {
        let s = sqlx::query_as::<_, UploadSession>(
            "SELECT id, user_id, filename, mime_type, total_size, chunk_size, temp_path, 
                    COALESCE(uploaded_parts, '{}') as uploaded_parts, created_at, expires_at 
             FROM upload_sessions WHERE id = $1 AND user_id = $2",
        )
        .bind(upload_id)
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or(AppError::NotFound)?;

        if s.expires_at < Utc::now() {
            self.abort_chunked_upload(upload_id, user_id).await?;
            return Err(AppError::Validation("上传会话已过期".to_string()));
        }
        Ok(s)
    }

    pub async fn upload_chunk(
        &self,
        upload_id: Uuid,
        user_id: Uuid,
        part_index: u32,
        data: Vec<u8>,
    ) -> Result<(), AppError> {
        let s = self.get_upload_session(upload_id, user_id).await?;
        let part = part_index as i32;
        if s.uploaded_parts.contains(&part) {
            return Ok(());
        }
        let total_parts = (s.total_size as u64).div_ceil(CHUNK_SIZE as u64) as i32;
        if part < 1 || part > total_parts {
            return Err(AppError::Validation(format!(
                "无效的分块索引: {}",
                part_index
            )));
        }

        let path = Path::new(&s.temp_path).join(format!("part_{}", part - 1));
        tokio::fs::write(&path, &data)
            .await
            .map_err(|e| AppError::Storage(format!("Failed to write chunk: {}", e)))?;

        let mut updated = s.uploaded_parts;
        updated.push(part);
        updated.sort_unstable();
        sqlx::query(
            "UPDATE upload_sessions SET uploaded_parts = $1 WHERE id = $2 AND user_id = $3",
        )
        .bind(&updated)
        .bind(upload_id)
        .bind(user_id)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn chunked_upload_status(
        &self,
        upload_id: Uuid,
        user_id: Uuid,
    ) -> Result<(Vec<i32>, u32), AppError> {
        let s = self.get_upload_session(upload_id, user_id).await?;
        let total_parts = (s.total_size as u64).div_ceil(CHUNK_SIZE as u64) as u32;
        Ok((s.uploaded_parts, total_parts))
    }

    pub async fn complete_chunked_upload(
        &self,
        upload_id: Uuid,
        user_id: Uuid,
        _req: CompleteChunkedUploadRequest,
    ) -> Result<FileResponse, AppError> {
        let s = self.get_upload_session(upload_id, user_id).await?;
        let total_parts = (s.total_size as u64).div_ceil(CHUNK_SIZE as u64) as u32;
        if s.uploaded_parts.len() != total_parts as usize {
            return Err(AppError::Validation(format!(
                "缺少分块: 已上传 {}/{}",
                s.uploaded_parts.len(),
                total_parts
            )));
        }

        // 顺序读取所有分块（保持内存效率，避免同时加载所有分块）
        let mut data = Vec::with_capacity(s.total_size as usize);
        let base_path = Path::new(&s.temp_path);
        
        for part_idx in 0..total_parts {
            let chunk_path = base_path.join(format!("part_{}", part_idx));
            let chunk = tokio::fs::read(&chunk_path)
                .await
                .map_err(|e| AppError::File(format!("读取分块 {} 失败: {}", part_idx, e)))?;
            data.extend_from_slice(&chunk);
        }

        if data.len() != s.total_size as usize {
            return Err(AppError::Validation("文件大小不匹配".to_string()));
        }

        let file = self
            .create_file(
                user_id,
                s.filename.clone(),
                s.mime_type.clone(),
                s.total_size as u64,
                data,
            )
            .await?;

        self.abort_chunked_upload(upload_id, user_id).await?;
        Ok(file)
    }

    pub async fn abort_chunked_upload(
        &self,
        upload_id: Uuid,
        user_id: Uuid,
    ) -> Result<(), AppError> {
        let temp_path = self.chunked_temp_dir(upload_id);
        if temp_path.exists() {
            let _ = tokio::fs::remove_dir_all(&temp_path).await;
        }
        sqlx::query("DELETE FROM upload_sessions WHERE id = $1 AND user_id = $2")
            .bind(upload_id)
            .bind(user_id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }
}

pub async fn create_storage(config: Arc<Config>) -> Result<Arc<dyn StorageBackend>, AppError> {
    match config.storage_backend.as_str() {
        "local" => Ok(Arc::new(LocalStorage::new(config.storage_path.clone()))),
        "s3" => {
            let s3_storage =
                S3Storage::new(config.aws_bucket.clone(), config.aws_region.clone()).await?;
            Ok(Arc::new(s3_storage))
        }
        _ => Err(AppError::Storage(format!(
            "Unknown storage backend: {}",
            config.storage_backend
        ))),
    }
}
