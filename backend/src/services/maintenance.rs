//! # Maintenance / Housekeeping
//!
//! 后台维护任务：清理过期分块上传会话、临时文件、孤儿文件等。

use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;

use sqlx::PgPool;
use uuid::Uuid;

use crate::repositories::{DynFilesRepo, SqlxFilesRepo};
use crate::services::storage::StorageBackend;
use crate::utils::AppError;

/// 本地存储下需跳过的顶层目录（非用户文件目录）
const SKIP_DIRS: &[&str] = &[".thumbnails", ".hls", ".chunked"];

/// 启动"过期分块上传会话"清理任务。
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
/// - **仅从 DB → 存储方向校验**：不会去扫描整个存储目录删除"孤儿文件"，避免大规模 I/O
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

    let files_repo: DynFilesRepo = Arc::new(SqlxFilesRepo::new(pool.clone()));

    for (id, user_id, file_path) in rows {
        match storage.open_read_stream(&file_path).await {
            Ok(_) => {
                // 文件存在，跳过
            }
            Err(AppError::File(_)) | Err(AppError::Storage(_)) => {
                // 底层报告"文件相关错误"或"存储后端错误"：视为文件已不存在，best-effort 删除 DB 记录
                if let Err(e) = files_repo.delete(id, user_id).await {
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

/// 周期性扫描本地存储目录，删除「磁盘上有文件但 DB 无记录」的孤儿文件。
///
/// 与 `spawn_files_consistency_checker` 方向相反：前者是「DB 有记录但文件丢了」删 DB；
/// 本任务是「磁盘有文件但 DB 无记录」删文件（多为上传落盘成功、落库失败或未完成）。
///
/// 单次执行孤儿文件清理（用于手动或脚本触发一轮），返回本轮删除的文件数。
pub async fn run_orphan_cleanup_once(
    pool: &PgPool,
    storage_path: &str,
    batch_limit: u32,
) -> anyhow::Result<u32> {
    delete_orphan_storage_files_once(pool, storage_path, batch_limit).await
}

/// 仅当 `storage_backend == "local"` 时启动。
/// 目录结构：`{storage_path}/{user_id}/[任意层嵌套目录]/<file_id>/<文件名>`，递归扫描；仅当某层目录名为 UUID 且其内为文件时才视为 file_id 目录并查库判孤儿。
pub fn spawn_orphan_storage_files_cleanup(
    pool: PgPool,
    storage_path: String,
    interval: Duration,
    batch_limit: u32,
) {
    tokio::spawn(async move {
        let mut tick = tokio::time::interval(interval);
        loop {
            tick.tick().await;
            if let Err(e) =
                delete_orphan_storage_files_once(&pool, &storage_path, batch_limit).await
            {
                tracing::warn!("orphan storage files cleanup failed: {}", e);
            }
        }
    });
}

/// 在 `user_id` 下递归扫描：任意层级子目录中，若某目录名为 UUID（视为 file_id）且其内为文件，则用 (file_id, user_id) 查库判断孤儿并删除。
async fn delete_orphan_storage_files_once(
    pool: &PgPool,
    storage_path: &str,
    batch_limit: u32,
) -> anyhow::Result<u32> {
    let base = Path::new(storage_path);
    if !base.exists() || !base.is_dir() {
        return Ok(0);
    }

    let files_repo: DynFilesRepo = Arc::new(SqlxFilesRepo::new(pool.clone()));
    let mut deleted = 0u32;
    tracing::debug!("orphan storage files cleanup run started (base={})", base.display());

    let mut user_dirs = tokio::fs::read_dir(base).await?;
    while let Ok(Some(user_entry)) = user_dirs.next_entry().await {
        let user_path = user_entry.path();
        if !user_path.is_dir() {
            continue;
        }
        let user_name = user_path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("");
        if SKIP_DIRS.contains(&user_name) {
            continue;
        }
        let user_id: Uuid = match user_name.parse() {
            Ok(u) => u,
            Err(_) => continue,
        };

        let _ = scan_user_dir_for_orphans(&files_repo, user_path.to_path_buf(), user_id, &mut deleted, batch_limit).await?;
        if deleted >= batch_limit {
            if deleted > 0 {
                tracing::info!("orphan storage files cleanup run finished, removed {} file(s)", deleted);
            }
            return Ok(deleted);
        }
    }

    if deleted > 0 {
        tracing::info!("orphan storage files cleanup run finished, removed {} file(s)", deleted);
    }
    Ok(deleted)
}

/// 扫描某 user_id 下目录（栈迭代，支持多层嵌套）：若目录名为 UUID 则视为 file_id 目录并查库判孤儿；否则只将子目录入栈。
async fn scan_user_dir_for_orphans(
    files_repo: &DynFilesRepo,
    root: PathBuf,
    user_id: Uuid,
    deleted: &mut u32,
    batch_limit: u32,
) -> anyhow::Result<u32> {
    let mut total = 0u32;
    let mut stack = vec![root];
    while let Some(dir) = stack.pop() {
        if *deleted >= batch_limit {
            break;
        }
        let dir_name = dir
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("");
        let file_id: Uuid = match dir_name.parse() {
            Ok(u) => u,
            Err(_) => {
                // 非 UUID 目录，仅将子目录入栈
                let mut entries = tokio::fs::read_dir(&dir).await?;
                while let Ok(Some(entry)) = entries.next_entry().await {
                    let path = entry.path();
                    if path.is_dir() {
                        stack.push(path);
                    }
                }
                continue;
            }
        };

        // 当前目录名为 UUID，视为 file_id 目录
        let mut entries = tokio::fs::read_dir(&dir).await?;
        let mut removed_here = 0u32;
        let mut subdirs = Vec::new();
        while let Ok(Some(entry)) = entries.next_entry().await {
            if *deleted >= batch_limit {
                break;
            }
            let path = entry.path();
            if path.is_file() {
                match files_repo.find_by_id(file_id, user_id).await {
                    Ok(Some(_)) => {}
                    Ok(None) | Err(_) => {
                        if tokio::fs::remove_file(&path).await.is_ok() {
                            *deleted += 1;
                            removed_here += 1;
                            total += 1;
                            tracing::info!("removed orphan file (no DB record): {}", path.display());
                        } else {
                            tracing::warn!("failed to remove orphan file {}", path.display());
                        }
                    }
                }
            } else if path.is_dir() {
                subdirs.push(path);
            }
        }
        for sub in subdirs {
            stack.push(sub);
        }
        if removed_here > 0 {
            let _ = tokio::fs::remove_dir(&dir).await;
        }
    }
    Ok(total)
}
