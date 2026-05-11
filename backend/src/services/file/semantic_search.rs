//! 语义搜索服务
//!
//! 使用向量相似度搜索实现基于文件名和内容的语义搜索。

use sqlx::PgPool;
use uuid::Uuid;

use crate::utils::AppError;

/// 语义搜索服务
pub struct SemanticSearchService {
    pool: PgPool,
}

impl SemanticSearchService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// 更新文件的向量嵌入
    ///
    /// # 参数
    /// - `file_id`: 文件 ID
    /// - `user_id`: 用户 ID（用于权限校验）
    /// - `embedding`: 384 维向量（f32 数组）
    pub async fn update_file_embedding(
        &self,
        file_id: Uuid,
        user_id: Uuid,
        embedding: &[f32],
    ) -> Result<(), AppError> {
        // 将 f32 向量转换为 PostgreSQL vector 类型的字符串格式
        // vector 类型格式：'[0.1, 0.2, 0.3]'::vector
        let embedding_str = format!(
            "[{}]",
            embedding
                .iter()
                .map(|v| v.to_string())
                .collect::<Vec<_>>()
                .join(",")
        );

        sqlx::query("UPDATE files SET embedding = $1::vector WHERE id = $2 AND user_id = $3")
            .bind(&embedding_str)
            .bind(file_id)
            .bind(user_id)
            .execute(&self.pool)
            .await
            .map_err(|e| {
                tracing::error!("Failed to update file embedding: {}", e);
                AppError::File("更新文件向量嵌入失败".to_string())
            })?;

        Ok(())
    }

    /// 语义搜索文件
    ///
    /// # 参数
    /// - `user_id`: 用户 ID（只搜索该用户的文件）
    /// - `query_embedding`: 查询文本的向量嵌入（384 维）
    /// - `limit`: 返回结果数量限制（默认 20）
    /// - `threshold`: 相似度阈值（0-1，默认 0.5，低于此值的结果不返回）
    ///
    /// # 返回
    /// - `Ok(Vec<Uuid>)`: 匹配的文件 ID 列表（按相似度降序）
    pub async fn search_files(
        &self,
        user_id: Uuid,
        query_embedding: &[f32],
        limit: Option<usize>,
        threshold: Option<f32>,
    ) -> Result<Vec<Uuid>, AppError> {
        let limit = limit.unwrap_or(20);
        let threshold = threshold.unwrap_or(0.5);

        // 将查询向量转换为 PostgreSQL vector 类型字符串
        let query_embedding_str = format!(
            "[{}]",
            query_embedding
                .iter()
                .map(|v| v.to_string())
                .collect::<Vec<_>>()
                .join(",")
        );

        // 使用余弦相似度搜索（1 - (embedding <=> query_embedding)）
        // <=> 是 pgvector 的余弦距离运算符，值越小表示越相似
        // 我们使用 1 - distance 作为相似度分数
        let rows = sqlx::query_scalar::<_, Uuid>(
            r#"
            SELECT id
            FROM files
            WHERE user_id = $1
              AND deleted_at IS NULL
              AND embedding IS NOT NULL
              AND (1 - (embedding <=> $2::vector)) >= $3
            ORDER BY embedding <=> $2::vector
            LIMIT $4
            "#,
        )
        .bind(user_id)
        .bind(&query_embedding_str)
        .bind(threshold)
        .bind(limit as i64)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| {
            tracing::error!("Semantic search failed: {}", e);
            AppError::File("语义搜索失败".to_string())
        })?;

        Ok(rows)
    }

    /// 批量更新文件的向量嵌入（用于初始化现有文件）
    ///
    /// # 参数
    /// - `file_ids`: 文件 ID 列表
    /// - `embeddings`: 对应的向量列表（每个向量 384 维）
    #[allow(dead_code)]
    pub async fn batch_update_embeddings(
        &self,
        file_ids: &[Uuid],
        embeddings: &[Vec<f32>],
    ) -> Result<(), AppError> {
        if file_ids.len() != embeddings.len() {
            return Err(AppError::Validation("文件 ID 和向量数量不匹配".to_string()));
        }

        // 使用事务批量更新
        let mut tx = self.pool.begin().await.map_err(|e| {
            tracing::error!("Failed to begin transaction: {}", e);
            AppError::File("批量更新向量嵌入失败".to_string())
        })?;

        for (file_id, embedding) in file_ids.iter().zip(embeddings.iter()) {
            let embedding_str = format!(
                "[{}]",
                embedding
                    .iter()
                    .map(|v| v.to_string())
                    .collect::<Vec<_>>()
                    .join(",")
            );

            sqlx::query("UPDATE files SET embedding = $1::vector WHERE id = $2")
                .bind(&embedding_str)
                .bind(file_id)
                .execute(&mut *tx)
                .await
                .map_err(|e| {
                    tracing::error!("Failed to update embedding for file {}: {}", file_id, e);
                    AppError::File("批量更新向量嵌入失败".to_string())
                })?;
        }

        tx.commit().await.map_err(|e| {
            tracing::error!("Failed to commit transaction: {}", e);
            AppError::File("批量更新向量嵌入失败".to_string())
        })?;

        Ok(())
    }
}
