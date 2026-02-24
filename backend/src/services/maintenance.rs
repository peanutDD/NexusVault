//! # Maintenance / Housekeeping
//!
//! 后台维护任务：清理过期分块上传会话、临时文件、孤儿文件等。

// =============================================================================
// 依赖与常量
// =============================================================================

use std::collections::HashSet; // 批量查库后用于 O(1) 判存在
use std::path::{Path, PathBuf}; // Path 判断存在/类型，PathBuf 栈迭代入栈
use std::sync::Arc; // StorageBackend、DynFilesRepo 用 Arc 共享
use std::time::Duration; // 轮询间隔

use sqlx::PgPool; // 查 upload_sessions、files，删记录
use uuid::Uuid; // user_id、file_id 解析与查库

use crate::repositories::{DynFilesRepo, SqlxFilesRepo}; // 查 files 表、删记录
use crate::services::storage::StorageBackend; // 打开读流校验文件是否存在
use crate::utils::AppError; // File/Storage 错误表示文件缺失

/// 本地存储下需跳过的顶层目录（非用户文件目录，扫描孤儿时不解为 user_id）
const SKIP_DIRS: &[&str] = &[".thumbnails", ".hls", ".chunked"];

/// 孤儿扫描时每批用 `find_by_ids` 一次查库的 file_id 数量，减少 DB 往返
const ORPHAN_DB_BATCH_SIZE: usize = 64;

pub fn spawn_zip_cache_cleanup(base_dir: PathBuf, interval: Duration, ttl_secs: u64) {
    tokio::spawn(async move {
        let mut tick = tokio::time::interval(interval);
        loop {
            tick.tick().await;
            let _ = cleanup_zip_cache_once(&base_dir, ttl_secs).await;
        }
    });
}

async fn cleanup_zip_cache_once(base_dir: &Path, ttl_secs: u64) -> anyhow::Result<u32> {
    if !base_dir.exists() || !base_dir.is_dir() {
        return Ok(0);
    }

    let mut deleted = 0u32;
    let mut user_dirs = tokio::fs::read_dir(base_dir).await?;
    while let Ok(Some(user_entry)) = user_dirs.next_entry().await {
        let user_path = user_entry.path();
        if !user_path.is_dir() {
            continue;
        }
        let mut files = tokio::fs::read_dir(&user_path).await?;
        while let Ok(Some(entry)) = files.next_entry().await {
            let p = entry.path();
            if !p.is_file() {
                continue;
            }
            let meta = match entry.metadata().await {
                Ok(m) => m,
                Err(_) => continue,
            };
            let modified = match meta.modified() {
                Ok(t) => t,
                Err(_) => continue,
            };
            let age_secs = match std::time::SystemTime::now().duration_since(modified) {
                Ok(d) => d.as_secs(),
                Err(_) => continue,
            };

            let name = p.file_name().and_then(|s| s.to_str()).unwrap_or("");
            let should_delete = if name.ends_with(".zip") {
                age_secs > ttl_secs
            } else if name.ends_with(".lock") || name.ends_with(".zip.tmp") {
                age_secs > 300
            } else {
                false
            };

            if should_delete && tokio::fs::remove_file(&p).await.is_ok() {
                deleted = deleted.saturating_add(1);
            }
        }
    }

    Ok(deleted)
}

// =============================================================================
// 过期分块上传会话清理（释放临时目录与 DB）
// =============================================================================

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
        let mut tick = tokio::time::interval(interval); // 首次 tick 立即就绪，之后按 interval
        loop {
            tick.tick().await; // 等待下一轮
            if let Err(e) = cleanup_expired_upload_sessions_once(&pool, batch_size).await {
                tracing::warn!("upload session cleanup failed: {}", e); // 单轮失败不退出任务
            }
        }
    });
}

/// 单轮：查出过期会话，删临时目录与 DB 记录。
async fn cleanup_expired_upload_sessions_once(
    pool: &PgPool,
    batch_size: i64,
) -> anyhow::Result<()> {
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
        let _ = tokio::fs::remove_dir_all(&temp_path).await; // 忽略错误（可能已被删）
        let _ = sqlx::query("DELETE FROM upload_sessions WHERE id = $1")
            .bind(id)
            .execute(pool)
            .await; // 忽略错误（可能并发已删）
    }

    Ok(())
}

// =============================================================================
// 文件一致性检查（DB → 存储：记录在但文件丢则删记录）
// =============================================================================

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

/// 单轮：取一批文件记录，逐条尝试打开读流；打开失败且为 File/Storage 错误则删 DB 记录。
async fn cleanup_missing_storage_files_once(
    pool: &PgPool,
    storage: Arc<dyn StorageBackend>,
    batch_size: i64,
) -> anyhow::Result<()> {
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
            Ok(_) => {} // 能打开则认为文件存在，不删
            Err(AppError::File(_)) | Err(AppError::Storage(_)) => {
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
                return Err(anyhow::anyhow!(format!(
                    "storage.open_read_stream failed for {}: {}",
                    file_path, e
                )));
            }
        }
    }

    Ok(())
}

// =============================================================================
// 孤儿存储文件清理（存储 → DB：磁盘有、DB 无则删文件）
// =============================================================================

/// 单次执行孤儿文件清理（如 RUN_ORPHAN_CLEANUP_ONCE=1），返回本轮删除的文件数。
pub async fn run_orphan_cleanup_once(
    pool: &PgPool,
    storage_path: &str,
    batch_limit: u32,
) -> anyhow::Result<u32> {
    delete_orphan_storage_files_once(pool, storage_path, batch_limit).await
}

/// 启动周期性孤儿文件清理任务；仅当 `storage_backend == "local"` 时在 main 中调用。
/// 目录结构：`{storage_path}/{user_id}/[任意层嵌套]/<file_id>/<文件名>`，栈迭代扫描。
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

/// 单轮孤儿清理：遍历 storage_path 下第一层目录（视为 user_id），跳过 SKIP_DIRS，对每个 user_id 调用 scan_user_dir_for_orphans；达到 batch_limit 即返回。
async fn delete_orphan_storage_files_once(
    pool: &PgPool,
    storage_path: &str,
    batch_limit: u32,
) -> anyhow::Result<u32> {
    let base = Path::new(storage_path);
    if !base.exists() || !base.is_dir() {
        return Ok(0); // 目录不存在或非目录则直接返回
    }

    let files_repo: DynFilesRepo = Arc::new(SqlxFilesRepo::new(pool.clone()));
    let mut deleted = 0u32;
    tracing::info!("orphan cleanup cycle started (base={})", base.display());

    let mut user_dirs = tokio::fs::read_dir(base).await?;
    while let Ok(Some(user_entry)) = user_dirs.next_entry().await {
        let user_path = user_entry.path();
        if !user_path.is_dir() {
            continue; // 只处理子目录（用户目录）
        }
        let user_name = user_path.file_name().and_then(|n| n.to_str()).unwrap_or("");
        if SKIP_DIRS.contains(&user_name) {
            continue; // .thumbnails、.hls、.chunked 不当作 user_id
        }
        let user_id: Uuid = match user_name.parse() {
            Ok(u) => u,
            Err(_) => continue, // 非 UUID 目录名跳过
        };

        let _ = scan_user_dir_for_orphans(
            &files_repo,
            user_path.to_path_buf(),
            user_id,
            &mut deleted,
            batch_limit,
        )
        .await?;
        if deleted >= batch_limit {
            tracing::info!("orphan cleanup cycle finished, removed {} file(s)", deleted);
            return Ok(deleted);
        }
    }

    tracing::info!("orphan cleanup cycle finished, removed {} file(s)", deleted);
    Ok(deleted)
}

// -----------------------------------------------------------------------------
// 孤儿扫描：栈迭代（无递归 async）+ 按 file_id 批量查库（find_by_ids）减少 DB 往返
// -----------------------------------------------------------------------------

/// 扫描某 user_id 下目录（栈迭代，支持多层嵌套）：目录名为 UUID 则视为 file_id 目录，先收集到 pending，
/// 满 ORPHAN_DB_BATCH_SIZE 或扫描结束后一次性 find_by_ids，再对「DB 无记录」的目录删文件并尝试删空目录。
async fn scan_user_dir_for_orphans(
    files_repo: &DynFilesRepo,
    root: PathBuf,
    user_id: Uuid,
    deleted: &mut u32,
    batch_limit: u32,
) -> anyhow::Result<u32> {
    let mut total = 0u32;
    let mut stack = vec![root];
    // (file_id, 目录路径, 该目录下待删文件路径列表)，攒满一批后 find_by_ids 一次查库
    let mut pending: Vec<(Uuid, PathBuf, Vec<PathBuf>)> = Vec::new();

    while let Some(dir) = stack.pop() {
        if *deleted >= batch_limit {
            break;
        }
        let dir_name = dir.file_name().and_then(|n| n.to_str()).unwrap_or("");
        let file_id: Uuid = match dir_name.parse() {
            Ok(u) => u,
            Err(_) => {
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

        // UUID 目录：收集该目录下所有文件路径与子目录，加入 pending，子目录入栈
        let mut entries = tokio::fs::read_dir(&dir).await?;
        let mut file_paths = Vec::new();
        let mut subdirs = Vec::new();
        while let Ok(Some(entry)) = entries.next_entry().await {
            let path = entry.path();
            if path.is_file() {
                file_paths.push(path);
            } else if path.is_dir() {
                subdirs.push(path);
            }
        }
        for sub in subdirs {
            stack.push(sub);
        }
        pending.push((file_id, dir, file_paths));

        // 攒够一批则一次性查库并删除孤儿
        if pending.len() >= ORPHAN_DB_BATCH_SIZE {
            flush_orphan_batch(
                files_repo,
                user_id,
                deleted,
                batch_limit,
                &mut pending,
                &mut total,
            )
            .await?;
        }
    }

    // 处理剩余 pending
    flush_orphan_batch(
        files_repo,
        user_id,
        deleted,
        batch_limit,
        &mut pending,
        &mut total,
    )
    .await?;
    Ok(total)
}

/// 对 pending 中的 (file_id, dir_path, file_paths) 做一次 find_by_ids，删除 DB 中不存在的目录下所有文件并尝试删空目录。
async fn flush_orphan_batch(
    files_repo: &DynFilesRepo,
    user_id: Uuid,
    deleted: &mut u32,
    batch_limit: u32,
    pending: &mut Vec<(Uuid, PathBuf, Vec<PathBuf>)>,
    total: &mut u32,
) -> anyhow::Result<()> {
    if pending.is_empty() {
        return Ok(());
    }
    let ids: Vec<Uuid> = pending.iter().map(|(id, _, _)| *id).collect();
    let existing = files_repo
        .find_by_ids(user_id, &ids)
        .await
        .map_err(|e| anyhow::anyhow!("{:?}", e))?;
    let exists_set: HashSet<Uuid> = existing.into_iter().map(|f| f.id).collect();

    for (file_id, dir_path, file_paths) in pending.drain(..) {
        if *deleted >= batch_limit {
            break;
        }
        if exists_set.contains(&file_id) {
            continue;
        }
        let mut removed_here = 0u32;
        for path in file_paths {
            if *deleted >= batch_limit {
                break;
            }
            if tokio::fs::remove_file(&path).await.is_ok() {
                *deleted += 1;
                removed_here += 1;
                *total += 1;
                tracing::info!("removed orphan file (no DB record): {}", path.display());
            } else {
                tracing::warn!("failed to remove orphan file {}", path.display());
            }
        }
        if removed_here > 0 {
            let _ = tokio::fs::remove_dir(&dir_path).await;
        }
    }
    Ok(())
}
