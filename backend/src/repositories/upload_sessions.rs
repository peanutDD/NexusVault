//! upload_sessions 表相关查询

use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::upload_session::UploadSession;
use crate::utils::AppError;

pub struct UploadSessionsRepo<'a> {
    pool: &'a PgPool,
}

impl<'a> UploadSessionsRepo<'a> {
    pub fn new(pool: &'a PgPool) -> Self {
        Self { pool }
    }

    pub async fn insert_session(
        &self,
        upload_id: Uuid,
        user_id: Uuid,
        filename: &str,
        mime_type: &str,
        total_size: u64,
        chunk_size: i32,
        temp_path: &str,
        expires_at: DateTime<Utc>,
    ) -> Result<(), AppError> {
        sqlx::query(
            "INSERT INTO upload_sessions (id, user_id, filename, mime_type, total_size, chunk_size, temp_path, expires_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
        )
        .bind(upload_id)
        .bind(user_id)
        .bind(filename)
        .bind(mime_type)
        .bind(total_size as i64)
        .bind(chunk_size)
        .bind(temp_path)
        .bind(expires_at)
        .execute(self.pool)
        .await?;
        Ok(())
    }

    pub async fn get_session(
        &self,
        upload_id: Uuid,
        user_id: Uuid,
    ) -> Result<Option<UploadSession>, AppError> {
        let s = sqlx::query_as::<_, UploadSession>(
            "SELECT id, user_id, filename, mime_type, total_size, chunk_size, temp_path,
                    COALESCE(uploaded_parts, '{}') as uploaded_parts, created_at, expires_at
             FROM upload_sessions WHERE id = $1 AND user_id = $2",
        )
        .bind(upload_id)
        .bind(user_id)
        .fetch_optional(self.pool)
        .await?;
        Ok(s)
    }

    pub async fn append_uploaded_part(
        &self,
        upload_id: Uuid,
        user_id: Uuid,
        part: i32,
    ) -> Result<(), AppError> {
        // 并发安全：原子追加，避免“读-改-写”丢更新
        sqlx::query(
            "UPDATE upload_sessions
             SET uploaded_parts = array_append(uploaded_parts, $1)
             WHERE id = $2 AND user_id = $3 AND NOT ($1 = ANY(uploaded_parts))",
        )
        .bind(part)
        .bind(upload_id)
        .bind(user_id)
        .execute(self.pool)
        .await?;
        Ok(())
    }

    pub async fn delete_session(&self, upload_id: Uuid, user_id: Uuid) -> Result<(), AppError> {
        sqlx::query("DELETE FROM upload_sessions WHERE id = $1 AND user_id = $2")
            .bind(upload_id)
            .bind(user_id)
            .execute(self.pool)
            .await?;
        Ok(())
    }

    /// 统计该用户当前未过期的分片上传会话数（用于限制同时进行的大文件数量）
    pub async fn count_active_sessions_by_user(&self, user_id: Uuid) -> Result<i64, AppError> {
        let row: (i64,) = sqlx::query_as(
            "SELECT COUNT(*)::BIGINT FROM upload_sessions WHERE user_id = $1 AND expires_at > NOW()",
        )
        .bind(user_id)
        .fetch_one(self.pool)
        .await?;
        Ok(row.0)
    }

    /// 获取该用户最旧的一个活跃会话
    pub async fn get_oldest_active_session_by_user(
        &self,
        user_id: Uuid,
    ) -> Result<Option<(Uuid, String)>, AppError> {
        let row: Option<(Uuid, String)> = sqlx::query_as(
            "SELECT id, temp_path FROM upload_sessions 
            WHERE user_id = $1 AND expires_at > NOW() 
            ORDER BY created_at ASC 
            LIMIT 1",
        )
        .bind(user_id)
        .fetch_optional(self.pool)
        .await?;
        Ok(row)
    }

    /// 删除该用户最旧的一个活跃会话（用于在达到上限时腾出空间）
    pub async fn delete_oldest_active_session_by_user(
        &self,
        user_id: Uuid,
    ) -> Result<(), AppError> {
        // 子查询查出最旧的一个 ID，然后删除它
        sqlx::query(
            "DELETE FROM upload_sessions WHERE id = (
                SELECT id FROM upload_sessions 
                WHERE user_id = $1 AND expires_at > NOW() 
                ORDER BY created_at ASC 
                LIMIT 1
            )",
        )
        .bind(user_id)
        .execute(self.pool)
        .await?;
        Ok(())
    }
}
