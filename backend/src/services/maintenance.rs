//! # Maintenance / Housekeeping
//!
//! 后台维护任务：清理过期分块上传会话、临时文件等。

use std::time::Duration;

use sqlx::PgPool;
use uuid::Uuid;

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

