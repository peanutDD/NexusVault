//! # Maintenance / Housekeeping
//! 后台维护任务：清理过期分块上传会话、临时文件、孤儿文件等。

// =============================================================================
// 依赖与常量
// =============================================================================

use std::collections::HashSet;
use std::ffi::OsStr;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;

use sqlx::{PgPool, Row};
use uuid::Uuid;

use crate::repositories::{DynFilesRepo, SqlxFilesRepo};
use crate::services::storage::StorageBackend;
use crate::utils::{is_macos_appledouble_filename, AppError};

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

pub fn spawn_direct_upload_session_cleanup(
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
                cleanup_expired_direct_upload_sessions_once(&pool, storage.clone(), batch_size)
                    .await
            {
                tracing::warn!(error = %e, "direct upload session cleanup failed");
            }
        }
    });
}

pub async fn cleanup_expired_direct_upload_sessions_once(
    pool: &PgPool,
    storage: Arc<dyn StorageBackend>,
    batch_size: i64,
) -> Result<u64, AppError> {
    let rows: Vec<(Uuid, String, String)> = sqlx::query_as(
        "SELECT id, object_key, upload_id
         FROM direct_upload_sessions
         WHERE expires_at < NOW()
         ORDER BY expires_at ASC
         LIMIT $1",
    )
    .bind(batch_size)
    .fetch_all(pool)
    .await
    .map_err(|e| {
        tracing::error!(error = %e, "Failed to query expired direct upload sessions");
        AppError::Database(e)
    })?;

    let mut cleaned = 0u64;
    for (id, object_key, multipart_upload_id) in rows {
        match storage
            .abort_multipart_upload(&object_key, &multipart_upload_id)
            .await
        {
            Ok(supported) => {
                tracing::info!(
                    session_id = %id,
                    object_key = %object_key,
                    multipart_upload_id = %multipart_upload_id,
                    abort_supported = supported,
                    "expired direct upload multipart aborted"
                );
            }
            Err(error) => {
                tracing::warn!(
                    session_id = %id,
                    object_key = %object_key,
                    multipart_upload_id = %multipart_upload_id,
                    %error,
                    "failed to abort expired direct upload multipart; deleting stale DB session"
                );
            }
        }

        sqlx::query("DELETE FROM direct_upload_sessions WHERE id = $1")
            .bind(id)
            .execute(pool)
            .await
            .map_err(|e| {
                tracing::warn!(error = %e, "Failed to delete expired direct upload session");
                AppError::Database(e)
            })?;
        cleaned = cleaned.saturating_add(1);
    }

    Ok(cleaned)
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

pub async fn cleanup_missing_storage_files_once(
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

    let mut missing_count = 0usize;

    for (id, user_id, file_path) in rows {
        match storage.open_read_stream(&file_path).await {
            Ok(_) => {}
            Err(AppError::NotFound) | Err(AppError::File(_)) | Err(AppError::Storage(_)) => {
                missing_count = missing_count.saturating_add(1);
                tracing::debug!(
                    file_id = %id,
                    user_id = %user_id,
                    file_path = %file_path,
                    "detected file record with missing storage object; kept database row"
                );
            }
            Err(e) => {
                return Err(AppError::Storage(format!(
                    "storage.open_read_stream failed for {}: {}",
                    file_path, e
                )));
            }
        }
    }

    if missing_count > 0 {
        tracing::warn!(
            missing_count,
            "detected file records with missing storage objects; database rows were preserved"
        );
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
    let mut moved_to_trash = 0u32;
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
            pool,
            &files_repo,
            user_path.to_path_buf(),
            user_id,
            &mut moved_to_trash,
            batch_limit,
        )
        .await?;
        if moved_to_trash >= batch_limit {
            tracing::info!(moved_to_trash, "orphan cleanup cycle finished");
            return Ok(moved_to_trash);
        }
    }

    tracing::info!(moved_to_trash, "orphan cleanup cycle finished");
    Ok(moved_to_trash)
}

async fn scan_user_dir_for_orphans(
    pool: &PgPool,
    files_repo: &DynFilesRepo,
    root: PathBuf,
    user_id: Uuid,
    moved_to_trash: &mut u32,
    batch_limit: u32,
) -> Result<u32, AppError> {
    let mut total = 0u32;
    let mut stack = vec![root];
    let mut pending: Vec<(Uuid, PathBuf, Vec<PathBuf>)> = Vec::new();

    while let Some(dir) = stack.pop() {
        if *moved_to_trash >= batch_limit {
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
                let filename = path
                    .file_name()
                    .and_then(|name| name.to_str())
                    .unwrap_or("");
                if is_macos_appledouble_filename(filename) {
                    continue;
                }
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
                pool,
                files_repo,
                user_id,
                moved_to_trash,
                batch_limit,
                &mut pending,
                &mut total,
            )
            .await?;
        }
    }

    flush_orphan_batch(
        pool,
        files_repo,
        user_id,
        moved_to_trash,
        batch_limit,
        &mut pending,
        &mut total,
    )
    .await?;
    Ok(total)
}

async fn flush_orphan_batch(
    pool: &PgPool,
    files_repo: &DynFilesRepo,
    user_id: Uuid,
    moved_to_trash: &mut u32,
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
    let pending_paths: Vec<String> = pending
        .iter()
        .flat_map(|(_, _, paths)| paths)
        .map(|path| path.to_string_lossy().to_string())
        .collect();
    let tracked_paths = find_tracked_storage_paths(pool, user_id, &pending_paths).await?;

    for (file_id, dir_path, file_paths) in pending.drain(..) {
        if *moved_to_trash >= batch_limit {
            break;
        }
        if exists_set.contains(&file_id) {
            continue;
        }
        for path in file_paths {
            if *moved_to_trash >= batch_limit {
                break;
            }
            let path_string = path.to_string_lossy().to_string();
            if tracked_paths.contains(&path_string) {
                continue;
            }
            match move_file_to_macos_trash(&path).await {
                Ok(trash_path) => {
                    *moved_to_trash += 1;
                    *total += 1;
                    tracing::debug!(
                        user_id = %user_id,
                        file_id = %file_id,
                        path = %path_string,
                        trash_path = %trash_path.display(),
                        dir = %dir_path.display(),
                        "moved untracked storage file to macOS Trash"
                    );
                }
                Err(error) => {
                    tracing::warn!(
                        user_id = %user_id,
                        file_id = %file_id,
                        path = %path_string,
                        dir = %dir_path.display(),
                        %error,
                        "failed to move untracked storage file to macOS Trash; file preserved"
                    );
                }
            }
        }
    }
    Ok(())
}

async fn move_file_to_macos_trash(path: &Path) -> Result<PathBuf, AppError> {
    let trash_dir = macos_trash_dir()?;
    tokio::fs::create_dir_all(&trash_dir)
        .await
        .map_err(|e| AppError::Storage(format!("failed to create macOS Trash directory: {e}")))?;

    let destination = unique_trash_destination(&trash_dir, path).await?;
    match tokio::fs::rename(path, &destination).await {
        Ok(()) => Ok(destination),
        Err(rename_error) => {
            tokio::fs::copy(path, &destination).await.map_err(|copy_error| {
                AppError::Storage(format!(
                    "failed to move file to macOS Trash: rename failed ({rename_error}); copy failed ({copy_error})"
                ))
            })?;
            if let Err(remove_error) = tokio::fs::remove_file(path).await {
                let _ = tokio::fs::remove_file(&destination).await;
                return Err(AppError::Storage(format!(
                    "failed to remove original after copying file to macOS Trash: {remove_error}"
                )));
            }
            Ok(destination)
        }
    }
}

fn macos_trash_dir() -> Result<PathBuf, AppError> {
    std::env::var_os("HOME")
        .map(PathBuf::from)
        .map(|home| home.join(".Trash"))
        .ok_or_else(|| AppError::Storage("HOME is not set; cannot locate macOS Trash".into()))
}

async fn unique_trash_destination(trash_dir: &Path, source: &Path) -> Result<PathBuf, AppError> {
    let file_name = source
        .file_name()
        .unwrap_or_else(|| OsStr::new("storage-file"));
    let token = Uuid::new_v4();
    for attempt in 0..10_000u32 {
        let destination = trash_dir.join(orphan_trash_filename(file_name, token, attempt));
        if !tokio::fs::try_exists(&destination)
            .await
            .map_err(|e| AppError::Storage(format!("failed to inspect macOS Trash: {e}")))?
        {
            return Ok(destination);
        }
    }

    Err(AppError::Storage(
        "failed to allocate unique macOS Trash filename".into(),
    ))
}

fn orphan_trash_filename(file_name: &OsStr, token: Uuid, attempt: u32) -> String {
    let file_name = file_name.to_string_lossy();
    if attempt == 0 {
        format!("orphan-storage-{token}-{file_name}")
    } else {
        format!("orphan-storage-{token}-{attempt}-{file_name}")
    }
}

async fn find_tracked_storage_paths(
    pool: &PgPool,
    user_id: Uuid,
    paths: &[String],
) -> Result<HashSet<String>, AppError> {
    if paths.is_empty() {
        return Ok(HashSet::new());
    }

    let rows = sqlx::query(
        "SELECT file_path FROM files WHERE user_id = $1 AND file_path = ANY($2)
         UNION
         SELECT file_path FROM file_versions WHERE user_id = $1 AND file_path = ANY($2)",
    )
    .bind(user_id)
    .bind(paths)
    .fetch_all(pool)
    .await?;

    rows.into_iter()
        .map(|row| {
            row.try_get::<String, _>("file_path")
                .map_err(AppError::from)
        })
        .collect()
}
