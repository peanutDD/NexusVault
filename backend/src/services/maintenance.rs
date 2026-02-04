//! # Maintenance / Housekeeping
//!
//! 后台维护任务：清理过期分块上传会话、临时文件等。

use std::time::Duration;

use sqlx::PgPool;
use uuid::Uuid;

use std::sync::Arc;

use crate::repositories::files::FilesRepo;
use crate::services::storage::StorageBackend;
use crate::utils::AppError;

/// 启动“过期分块上传会话”清理任务。
///
/// - 周期性查询 `upload_sessions.expires_at < NOW()` 的记录
/// - best-effort 删除 `temp_path` 目录
/// - 删除 DB 记录
///
/// 参数建议：
/// - `interval`: 例如 5 分钟
/// - `batch_size`: 例如 200（避免单次清理占用过多 DB/IO）
pub fn spawn_upload_session_cleanup(pool: PgPool, interval: Duration, batch_size: i64) {
    tokio::spawn(async move {
        let mut tick = tokio::time::interval(interval);
        loop {
            tick.tick().await;
            if let Err(e) = cleanup_expired_upload_sessions_once(&pool, batch_size).await {
                tracing::warn!("upload session cleanup failed: {}", e);
            }
        }
    });
}

async fn cleanup_expired_upload_sessions_once(
    pool: &PgPool,
    batch_size: i64,
) -> anyhow::Result<()> {
    // 选出过期会话（limit 批量处理）
    let rows: Vec<(Uuid, String)> = sqlx::query_as(
        "SELECT id, temp_path FROM upload_sessions WHERE expires_at < NOW() ORDER BY expires_at ASC LIMIT $1",
    )
    .bind(batch_size)
    .fetch_all(pool)
    .await?;

    if rows.is_empty() {
        return Ok(());
    }

    for (id, temp_path) in rows {
        // best-effort 删除临时目录
        let _ = tokio::fs::remove_dir_all(&temp_path).await;
        // best-effort 删除 DB 记录（如果被并发删除也没关系）
        let _ = sqlx::query("DELETE FROM upload_sessions WHERE id = $1")
            .bind(id)
            .execute(pool)
            .await;
    }

    Ok(())
}

/// 周期性检查 `files` 表中记录是否仍然有对应的物理文件；若文件已不存在，则删除对应 DB 记录。
///
/// 设计目标：
/// - **保护读路径**：避免下载/预览时因为底层文件丢失导致反复报错
/// - **仅从 DB → 存储方向校验**：不会去扫描整个存储目录删除“孤儿文件”，避免大规模 I/O
///
/// 行为：
/// - 每次从 `files` 表中按 `updated_at DESC` 取一批记录（最近被操作的更容易出问题）
/// - 尝试通过 `StorageBackend::open_read_stream` 打开文件
///   - 若成功：认为文件存在，跳过
///   - 若返回 `AppError::File` / `AppError::Storage`：视为文件已不存在，best-effort 删除 DB 记录
///   - 若返回其他错误：直接返回错误，避免误删
pub fn spawn_files_consistency_checker(
    pool: PgPool,
    storage: Arc<dyn StorageBackend>,
    interval: Duration,
    batch_size: i64,
) {
    tokio::spawn(async move {
        let mut tick = tokio::time::interval(interval);
        loop {
            tick.tick().await;
            if let Err(e) =
                cleanup_missing_storage_files_once(&pool, storage.clone(), batch_size).await
            {
                tracing::warn!("files consistency check failed: {}", e);
            }
        }
    });
}

async fn cleanup_missing_storage_files_once(
    pool: &PgPool,
    storage: Arc<dyn StorageBackend>,
    batch_size: i64,
) -> anyhow::Result<()> {
    // 选出最近更新的一批文件记录
    let rows: Vec<(Uuid, Uuid, String)> = sqlx::query_as(
        "SELECT id, user_id, file_path FROM files ORDER BY updated_at DESC LIMIT $1",
    )
    .bind(batch_size)
    .fetch_all(pool)
    .await?;

    if rows.is_empty() {
        return Ok(());
    }

    let repo = FilesRepo::new(pool);

    for (id, user_id, file_path) in rows {
        match storage.open_read_stream(&file_path).await {
            Ok(_) => {
                // 文件存在，跳过
            }
            Err(AppError::File(_)) | Err(AppError::Storage(_)) => {
                // 底层报告“文件相关错误”或“存储后端错误”：视为文件已不存在，best-effort 删除 DB 记录
                if let Err(e) = repo.delete_file_record(id, user_id).await {
                    tracing::warn!(
                        "failed to delete orphan file record id={} user_id={}: {}",
                        id,
                        user_id,
                        e
                    );
                } else {
                    tracing::info!(
                        "deleted orphan file record id={} user_id={} (missing storage file: {})",
                        id,
                        user_id,
                        file_path
                    );
                }
            }
            Err(e) => {
                // 其他类型错误直接返回，避免误删
                return Err(anyhow::anyhow!(format!(
                    "storage.open_read_stream failed for {}: {}",
                    file_path, e
                )));
            }
        }
    }

    Ok(())
}

