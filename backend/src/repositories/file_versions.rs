//! # 文件版本数据访问层 - SQLx 实现
//!
//! 提供 `FileVersionsRepository` trait 的 PostgreSQL/SQLx 实现。

use async_trait::async_trait;
use sqlx::{PgPool, Row};
use uuid::Uuid;

use crate::models::file::FileVersion;
use crate::utils::AppError;

use super::traits::FileVersionsRepository;

/// SQLx 实现的文件版本 Repository
pub struct SqlxFileVersionsRepo {
    pool: PgPool,
}

impl SqlxFileVersionsRepo {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl FileVersionsRepository for SqlxFileVersionsRepo {
    async fn create_version(
        &self,
        file_id: Uuid,
        user_id: Uuid,
        version_number: i32,
        filename: &str,
        original_filename: &str,
        file_path: &str,
        file_size: u64,
        mime_type: &str,
        storage_backend: &str,
        content_sha256: Option<&str>,
    ) -> Result<FileVersion, AppError> {
        sqlx::query_as::<_, FileVersion>(
            "INSERT INTO file_versions (
                file_id, user_id, version_number, filename, original_filename,
                file_path, file_size, mime_type, storage_backend, content_sha256
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING *",
        )
        .bind(file_id)
        .bind(user_id)
        .bind(version_number)
        .bind(filename)
        .bind(original_filename)
        .bind(file_path)
        .bind(file_size as i64)
        .bind(mime_type)
        .bind(storage_backend)
        .bind(content_sha256)
        .fetch_one(&self.pool)
        .await
        .map_err(AppError::from)
    }

    async fn list_versions(&self, file_id: Uuid, user_id: Uuid) -> Result<Vec<FileVersion>, AppError> {
        sqlx::query_as::<_, FileVersion>(
            "SELECT * FROM file_versions
             WHERE file_id = $1 AND user_id = $2
             ORDER BY version_number DESC",
        )
        .bind(file_id)
        .bind(user_id)
        .fetch_all(&self.pool)
        .await
        .map_err(AppError::from)
    }

    async fn get_version(&self, version_id: Uuid, user_id: Uuid) -> Result<Option<FileVersion>, AppError> {
        sqlx::query_as::<_, FileVersion>(
            "SELECT * FROM file_versions
             WHERE id = $1 AND user_id = $2",
        )
        .bind(version_id)
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(AppError::from)
    }

    async fn get_max_version_number(&self, file_id: Uuid) -> Result<i32, AppError> {
        let row = sqlx::query("SELECT COALESCE(MAX(version_number), 0) as max_version FROM file_versions WHERE file_id = $1")
            .bind(file_id)
            .fetch_one(&self.pool)
            .await?;
        
        Ok(row.try_get::<i32, _>("max_version")?)
    }

    async fn update_label(&self, version_id: Uuid, user_id: Uuid, label: Option<&str>) -> Result<(), AppError> {
        let affected = sqlx::query(
            "UPDATE file_versions SET label = $1 WHERE id = $2 AND user_id = $3",
        )
        .bind(label)
        .bind(version_id)
        .bind(user_id)
        .execute(&self.pool)
        .await?;

        if affected.rows_affected() == 0 {
            return Err(AppError::NotFound);
        }

        Ok(())
    }

    async fn delete_version(&self, version_id: Uuid, user_id: Uuid) -> Result<String, AppError> {
        // 先查询文件路径
        let row = sqlx::query("SELECT file_path FROM file_versions WHERE id = $1 AND user_id = $2")
            .bind(version_id)
            .bind(user_id)
            .fetch_optional(&self.pool)
            .await?;

        let file_path = match row {
            Some(r) => r.try_get::<String, _>("file_path")?,
            None => return Err(AppError::NotFound),
        };

        // 删除记录
        let affected = sqlx::query("DELETE FROM file_versions WHERE id = $1 AND user_id = $2")
            .bind(version_id)
            .bind(user_id)
            .execute(&self.pool)
            .await?;

        if affected.rows_affected() == 0 {
            return Err(AppError::NotFound);
        }

        Ok(file_path)
    }

    async fn cleanup_old_versions(&self, file_id: Uuid, keep_count: i32) -> Result<Vec<String>, AppError> {
        // 查询需要删除的版本（保留最新的 keep_count 个）
        let rows = sqlx::query(
            "SELECT id, file_path FROM file_versions
             WHERE file_id = $1
             ORDER BY version_number DESC
             OFFSET $2",
        )
        .bind(file_id)
        .bind(keep_count)
        .fetch_all(&self.pool)
        .await?;

        if rows.is_empty() {
            return Ok(Vec::new());
        }

        let version_ids: Vec<Uuid> = rows
            .iter()
            .map(|r| r.try_get::<Uuid, _>("id").unwrap())
            .collect();
        let file_paths: Vec<String> = rows
            .iter()
            .map(|r| r.try_get::<String, _>("file_path").unwrap())
            .collect();

        // 批量删除
        sqlx::query("DELETE FROM file_versions WHERE id = ANY($1)")
            .bind(&version_ids)
            .execute(&self.pool)
            .await?;

        Ok(file_paths)
    }
}
