//! # Maintenance / Housekeeping
//! 后台维护任务：清理过期分块上传会话、临时文件、孤儿文件等。

// =============================================================================
// 依赖与常量
// =============================================================================

use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;

use sqlx::PgPool;
use uuid::Uuid;

use crate::repositories::{DynFilesRepo, SqlxFilesRepo};
use crate::services::storage::StorageBackend;
use crate::utils::AppError;

const SKIP_DIRS: &[&str] = &[".thumbnails", ".hls", ".chunked", ".derived_videos"];
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

async fn cleanup_zip_cache_once(base_dir: &Path, ttl_secs: u64) -> Result<u32, AppError> {
    if !base_dir.exists() || !base_dir.is_dir() {
        return Ok(0);
    }

    let mut deleted = 0u32;
    let mut user_dirs = tokio::fs::read_dir(base_dir).await.map_err(|e| {
        tracing::error!(error = %e, "Failed to read zip cache dir");
        AppError::Internal
    })?;
    while let Ok(Some(user_entry)) = user_dirs.next_entry().await {
        let user_path = user_entry.path();
        if !user_path.is_dir() {
            continue;
        }
        let mut files = tokio::fs::read_dir(&user_path).await.map_err(|e| {
            tracing::error!(error = %e, "Failed to read user cache dir");
            AppError::Internal
        })?;
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
// 过期分块上传会话清理
// =============================================================================

pub fn spawn_upload_session_cleanup(pool: PgPool, interval: Duration, batch_size: i64) {
    tokio::spawn(async move {
        let mut tick = tokio::time::interval(interval);
        loop {
            tick.tick().await;
            if let Err(e) = cleanup_expired_upload_sessions_once(&pool, batch_size).await {
                tracing::warn!(error = %e, "upload session cleanup failed");
            }
        }
    });
}

async fn cleanup_expired_upload_sessions_once(
    pool: &PgPool,
    batch_size: i64,
) -> Result<(), AppError> {
    let rows: Vec<(Uuid, String)> = sqlx::query_as(
        "SELECT id, temp_path FROM upload_sessions WHERE expires_at < NOW() ORDER BY expires_at ASC LIMIT $1",
    )
    .bind(batch_size)
    .fetch_all(pool)
    .await
    .map_err(|e| {
        tracing::error!(error = %e, "Failed to query expired upload sessions");
        AppError::Database(e)
    })?;

    if rows.is_empty() {
        return Ok(());
    }

    for (id, temp_path) in rows {
        let _ = tokio::fs::remove_dir_all(&temp_path).await;
        let _ = sqlx::query("DELETE FROM upload_sessions WHERE id = $1")
            .bind(id)
            .execute(pool)
            .await
            .map_err(|e| {
                tracing::warn!(error = %e, "Failed to delete expired upload session");
                AppError::Database(e)
            });
    }

    Ok(())
}

// =============================================================================
// 文件一致性检查
// =============================================================================

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
                tracing::warn!(error = %e, "files consistency check failed");
            }
        }
    });
}

async fn cleanup_missing_storage_files_once(
    pool: &PgPool,
    storage: Arc<dyn StorageBackend>,
    batch_size: i64,
) -> Result<(), AppError> {
    let rows: Vec<(Uuid, Uuid, String)> = sqlx::query_as(
        "SELECT id, user_id, file_path FROM files ORDER BY updated_at DESC LIMIT $1",
    )
    .bind(batch_size)
    .fetch_all(pool)
    .await
    .map_err(|e| {
        tracing::error!(error = %e, "Failed to query files for consistency check");
        AppError::Database(e)
    })?;

    if rows.is_empty() {
        return Ok(());
    }

    let files_repo: DynFilesRepo = Arc::new(SqlxFilesRepo::new(pool.clone()));

    for (id, user_id, file_path) in rows {
        match storage.open_read_stream(&file_path).await {
            Ok(_) => {}
            Err(AppError::File(_)) | Err(AppError::Storage(_)) => {
                if let Err(e) = files_repo.delete(id, user_id).await {
                    tracing::warn!(
                        error = %e,
                        "failed to delete orphan file record id={} user_id={}",
                        id,
                        user_id
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
                return Err(AppError::Storage(format!(
                    "storage.open_read_stream failed for {}: {}",
                    file_path, e
                )));
            }
        }
    }

    Ok(())
}

// =============================================================================
// 孤儿存储文件清理
// =============================================================================

pub async fn run_orphan_cleanup_once(
    pool: &PgPool,
    storage_path: &str,
    batch_limit: u32,
) -> Result<u32, AppError> {
    delete_orphan_storage_files_once(pool, storage_path, batch_limit).await
}

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
                tracing::warn!(error = %e, "orphan storage files cleanup failed");
            }
        }
    });
}

async fn delete_orphan_storage_files_once(
    pool: &PgPool,
    storage_path: &str,
    batch_limit: u32,
) -> Result<u32, AppError> {
    let base = Path::new(storage_path);
    if !base.exists() || !base.is_dir() {
        return Ok(0);
    }

    let files_repo: DynFilesRepo = Arc::new(SqlxFilesRepo::new(pool.clone()));
    let mut deleted = 0u32;
    tracing::info!(base = %base.display(), "orphan cleanup cycle started");

    let mut user_dirs = tokio::fs::read_dir(base).await.map_err(|e| {
        tracing::error!(error = %e, "Failed to read storage path");
        AppError::Internal
    })?;
    while let Ok(Some(user_entry)) = user_dirs.next_entry().await {
        let user_path = user_entry.path();
        if !user_path.is_dir() {
            continue;
        }
        let user_name = user_path.file_name().and_then(|n| n.to_str()).unwrap_or("");
        if SKIP_DIRS.contains(&user_name) {
            continue;
        }
        let user_id: Uuid = match user_name.parse() {
            Ok(u) => u,
            Err(_) => continue,
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
            tracing::info!(deleted, "orphan cleanup cycle finished");
            return Ok(deleted);
        }
    }

    tracing::info!(deleted, "orphan cleanup cycle finished");
    Ok(deleted)
}

async fn scan_user_dir_for_orphans(
    files_repo: &DynFilesRepo,
    root: PathBuf,
    user_id: Uuid,
    deleted: &mut u32,
    batch_limit: u32,
) -> Result<u32, AppError> {
    let mut total = 0u32;
    let mut stack = vec![root];
    let mut pending: Vec<(Uuid, PathBuf, Vec<PathBuf>)> = Vec::new();

    while let Some(dir) = stack.pop() {
        if *deleted >= batch_limit {
            break;
        }
        let dir_name = dir.file_name().and_then(|n| n.to_str()).unwrap_or("");
        let file_id: Uuid = match dir_name.parse() {
            Ok(u) => u,
            Err(_) => {
                let mut entries = tokio::fs::read_dir(&dir).await.map_err(|e| {
                    tracing::error!(error = %e, "Failed to read directory");
                    AppError::Internal
                })?;
                while let Ok(Some(entry)) = entries.next_entry().await {
                    let path = entry.path();
                    if path.is_dir() {
                        stack.push(path);
                    }
                }
                continue;
            }
        };

        let mut entries = tokio::fs::read_dir(&dir).await.map_err(|e| {
            tracing::error!(error = %e, "Failed to read file directory");
            AppError::Internal
        })?;
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

async fn flush_orphan_batch(
    files_repo: &DynFilesRepo,
    user_id: Uuid,
    deleted: &mut u32,
    batch_limit: u32,
    pending: &mut Vec<(Uuid, PathBuf, Vec<PathBuf>)>,
    total: &mut u32,
) -> Result<(), AppError> {
    if pending.is_empty() {
        return Ok(());
    }
    let ids: Vec<Uuid> = pending.iter().map(|(id, _, _)| *id).collect();
    let existing = files_repo.find_by_ids(user_id, &ids).await.map_err(|e| {
        tracing::error!(error = %e, "Failed to find files by ids");
        e
    })?;
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
                tracing::info!(path = %path.display(), "removed orphan file");
            } else {
                tracing::warn!(path = %path.display(), "failed to remove orphan file");
            }
        }
        if removed_here > 0 {
            let _ = tokio::fs::remove_dir(&dir_path).await;
        }
    }
    Ok(())
}
