//! 后台维护任务回归测试。

mod common;

use std::io;
use std::sync::{
    atomic::{AtomicUsize, Ordering},
    Arc, Mutex,
};

use async_trait::async_trait;
use chrono::{Duration as ChronoDuration, Utc};
use common::{cleanup_test_data, create_test_pool, create_test_user, init_test_env};
use file_storage_backend::{
    services::{
        maintenance::{
            cleanup_expired_direct_upload_sessions_once, cleanup_missing_storage_files_once,
            run_orphan_cleanup_once,
        },
        storage::{LocalStorage, StorageBackend, StorageReadStream},
    },
    utils::AppError,
};
use serial_test::serial;
use tracing_subscriber::{fmt::MakeWriter, EnvFilter};
use uuid::Uuid;

struct EnvVarGuard {
    key: &'static str,
    saved: Option<std::ffi::OsString>,
}

impl EnvVarGuard {
    fn set<K>(key: &'static str, value: K) -> Self
    where
        K: AsRef<std::ffi::OsStr>,
    {
        let saved = std::env::var_os(key);
        std::env::set_var(key, value);
        Self { key, saved }
    }
}

impl Drop for EnvVarGuard {
    fn drop(&mut self) {
        match self.saved.take() {
            Some(value) => std::env::set_var(self.key, value),
            None => std::env::remove_var(self.key),
        }
    }
}

#[derive(Clone, Default)]
struct SharedLogWriter {
    buffer: Arc<Mutex<Vec<u8>>>,
}

impl SharedLogWriter {
    fn contents(&self) -> String {
        String::from_utf8_lossy(&self.buffer.lock().unwrap()).into_owned()
    }
}

struct SharedLogBuffer {
    buffer: Arc<Mutex<Vec<u8>>>,
}

impl io::Write for SharedLogBuffer {
    fn write(&mut self, buf: &[u8]) -> io::Result<usize> {
        self.buffer.lock().unwrap().extend_from_slice(buf);
        Ok(buf.len())
    }

    fn flush(&mut self) -> io::Result<()> {
        Ok(())
    }
}

impl<'a> MakeWriter<'a> for SharedLogWriter {
    type Writer = SharedLogBuffer;

    fn make_writer(&'a self) -> Self::Writer {
        SharedLogBuffer {
            buffer: self.buffer.clone(),
        }
    }
}

#[derive(Default)]
struct FakeDirectCleanupStorage {
    abort_count: AtomicUsize,
}

#[async_trait]
impl StorageBackend for FakeDirectCleanupStorage {
    async fn save_file(
        &self,
        _user_id: Uuid,
        _file_id: Uuid,
        _filename: &str,
        _data: &[u8],
    ) -> Result<String, AppError> {
        unimplemented!("not used")
    }

    async fn save_file_from_path(
        &self,
        _user_id: Uuid,
        _file_id: Uuid,
        _filename: &str,
        _source_path: &std::path::Path,
    ) -> Result<String, AppError> {
        unimplemented!("not used")
    }

    async fn copy_file_to_user(
        &self,
        _source_path: &str,
        _user_id: Uuid,
        _file_id: Uuid,
        _filename: &str,
    ) -> Result<String, AppError> {
        unimplemented!("not used")
    }

    async fn get_file(&self, _file_path: &str) -> Result<Vec<u8>, AppError> {
        unimplemented!("not used")
    }

    async fn open_read_stream(&self, _file_path: &str) -> Result<StorageReadStream, AppError> {
        unimplemented!("not used")
    }

    async fn open_read_stream_range(
        &self,
        _file_path: &str,
        _start: u64,
        _end_inclusive: u64,
    ) -> Result<StorageReadStream, AppError> {
        unimplemented!("not used")
    }

    async fn abort_multipart_upload(
        &self,
        _object_key: &str,
        _upload_id: &str,
    ) -> Result<bool, AppError> {
        self.abort_count.fetch_add(1, Ordering::SeqCst);
        Ok(true)
    }

    async fn delete_file(&self, _file_path: &str) -> Result<(), AppError> {
        unimplemented!("not used")
    }

    async fn get_thumbnail(&self, _file_id: Uuid, _user_id: Uuid) -> Result<Vec<u8>, AppError> {
        unimplemented!("not used")
    }

    async fn save_thumbnail(
        &self,
        _file_id: Uuid,
        _user_id: Uuid,
        _data: &[u8],
    ) -> Result<(), AppError> {
        unimplemented!("not used")
    }

    async fn delete_thumbnail(&self, _file_id: Uuid, _user_id: Uuid) -> Result<(), AppError> {
        unimplemented!("not used")
    }

    async fn health_check(&self) -> Result<(), AppError> {
        Ok(())
    }
}

#[tokio::test]
async fn direct_upload_cleanup_aborts_expired_multipart_sessions() {
    init_test_env();
    let pool = create_test_pool().await;
    cleanup_test_data(&pool).await;
    let (user_id, _, _) = create_test_user(&pool, "direct_cleanup").await;

    let expired_id = Uuid::new_v4();
    let fresh_id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO direct_upload_sessions
         (id, user_id, upload_id, object_key, part_size, expires_at)
         VALUES ($1, $2, 'expired-upload', 'users/expired.bin', 8388608, $3),
                ($4, $2, 'fresh-upload', 'users/fresh.bin', 8388608, $5)",
    )
    .bind(expired_id)
    .bind(user_id)
    .bind(Utc::now() - ChronoDuration::minutes(5))
    .bind(fresh_id)
    .bind(Utc::now() + ChronoDuration::minutes(5))
    .execute(&pool)
    .await
    .unwrap();

    let storage = Arc::new(FakeDirectCleanupStorage::default());
    let cleaned = cleanup_expired_direct_upload_sessions_once(&pool, storage.clone(), 100)
        .await
        .unwrap();

    assert_eq!(cleaned, 1);
    assert_eq!(storage.abort_count.load(Ordering::SeqCst), 1);

    let expired_exists: Option<Uuid> =
        sqlx::query_scalar("SELECT id FROM direct_upload_sessions WHERE id = $1")
            .bind(expired_id)
            .fetch_optional(&pool)
            .await
            .unwrap();
    let fresh_exists: Option<Uuid> =
        sqlx::query_scalar("SELECT id FROM direct_upload_sessions WHERE id = $1")
            .bind(fresh_id)
            .fetch_optional(&pool)
            .await
            .unwrap();

    assert!(expired_exists.is_none());
    assert_eq!(fresh_exists, Some(fresh_id));
}

#[tokio::test]
async fn files_consistency_cleanup_keeps_database_record_when_storage_object_is_missing() {
    init_test_env();
    let pool = create_test_pool().await;
    cleanup_test_data(&pool).await;
    let (user_id, _, _) = create_test_user(&pool, "missing_storage_cleanup").await;

    let file_id = common::create_test_file(&pool, user_id, "missing-storage.txt").await;
    let file_path: String = sqlx::query_scalar("SELECT file_path FROM files WHERE id = $1")
        .bind(file_id)
        .fetch_one(&pool)
        .await
        .unwrap();
    tokio::fs::remove_file(&file_path).await.unwrap();

    let storage = Arc::new(LocalStorage::new(
        "/tmp/maintenance-missing-storage".to_string(),
    ));
    cleanup_missing_storage_files_once(&pool, storage, 100)
        .await
        .unwrap();

    let still_exists: Option<Uuid> = sqlx::query_scalar("SELECT id FROM files WHERE id = $1")
        .bind(file_id)
        .fetch_optional(&pool)
        .await
        .unwrap();
    assert_eq!(still_exists, Some(file_id));
}

#[tokio::test]
#[serial(orphan_cleanup_home)]
async fn orphan_storage_cleanup_moves_untracked_upload_files_to_macos_trash() {
    init_test_env();
    let pool = create_test_pool().await;
    cleanup_test_data(&pool).await;
    let (user_id, _, _) = create_test_user(&pool, "trash_orphan_storage").await;

    let home_dir = tempfile::tempdir().unwrap();
    let trash_dir = home_dir.path().join(".Trash");
    tokio::fs::create_dir_all(&trash_dir).await.unwrap();
    let _home_guard = EnvVarGuard::set("HOME", home_dir.path());
    let storage_dir = tempfile::tempdir().unwrap();
    let file_id = Uuid::new_v4();
    let file_path = storage_dir
        .path()
        .join(user_id.to_string())
        .join(file_id.to_string())
        .join("survives.txt");
    tokio::fs::create_dir_all(file_path.parent().unwrap())
        .await
        .unwrap();
    tokio::fs::write(&file_path, b"still here").await.unwrap();

    let moved = run_orphan_cleanup_once(&pool, &storage_dir.path().to_string_lossy(), 100)
        .await
        .unwrap();

    assert_eq!(moved, 1);
    assert!(!tokio::fs::try_exists(&file_path).await.unwrap());

    let mut entries = tokio::fs::read_dir(&trash_dir).await.unwrap();
    let trashed = entries
        .next_entry()
        .await
        .unwrap()
        .expect("orphan file should be moved to macOS Trash");
    assert!(entries.next_entry().await.unwrap().is_none());
    assert_eq!(
        tokio::fs::read(trashed.path()).await.unwrap(),
        b"still here"
    );
    assert!(trashed.file_name().to_string_lossy().contains("survives"));
}

#[tokio::test(flavor = "current_thread")]
async fn orphan_storage_cleanup_does_not_report_tracked_file_versions_as_untracked() {
    let pool = create_test_pool().await;
    cleanup_test_data(&pool).await;
    let (user_id, _, _) = create_test_user(&pool, "tracked_version_storage").await;

    let storage_dir = tempfile::tempdir().unwrap();
    let current_file_id = Uuid::new_v4();
    let version_dir_id = Uuid::new_v4();
    let current_path = storage_dir
        .path()
        .join(user_id.to_string())
        .join(current_file_id.to_string())
        .join("current.jpg");
    let version_path = storage_dir
        .path()
        .join(user_id.to_string())
        .join(version_dir_id.to_string())
        .join(format!("{version_dir_id}_v1-photo.jpg"));
    tokio::fs::create_dir_all(current_path.parent().unwrap())
        .await
        .unwrap();
    tokio::fs::create_dir_all(version_path.parent().unwrap())
        .await
        .unwrap();
    tokio::fs::write(&current_path, b"current image")
        .await
        .unwrap();
    tokio::fs::write(&version_path, b"version image")
        .await
        .unwrap();

    sqlx::query(
        "INSERT INTO files
         (id, user_id, filename, original_filename, file_path, file_size, mime_type, storage_backend)
         VALUES ($1, $2, 'current.jpg', 'current.jpg', $3, 13, 'image/jpeg', 'local')",
    )
    .bind(current_file_id)
    .bind(user_id)
    .bind(current_path.to_string_lossy().to_string())
    .execute(&pool)
    .await
    .unwrap();

    sqlx::query(
        "INSERT INTO file_versions
         (file_id, user_id, version_number, filename, original_filename, file_path, file_size, mime_type, storage_backend)
         VALUES ($1, $2, 1, 'current.jpg', 'current.jpg', $3, 13, 'image/jpeg', 'local')",
    )
    .bind(current_file_id)
    .bind(user_id)
    .bind(version_path.to_string_lossy().to_string())
    .execute(&pool)
    .await
    .unwrap();

    let writer = SharedLogWriter::default();
    let subscriber = tracing_subscriber::fmt()
        .with_writer(writer.clone())
        .with_env_filter(EnvFilter::new(
            "file_storage_backend::services::maintenance=trace",
        ))
        .without_time()
        .finish();
    let dispatch = tracing::Dispatch::new(subscriber);
    let _guard = tracing::dispatcher::set_default(&dispatch);

    run_orphan_cleanup_once(&pool, &storage_dir.path().to_string_lossy(), 100)
        .await
        .unwrap();

    let logs = writer.contents();
    assert!(
        !logs.contains("moved untracked storage file to macOS Trash"),
        "tracked file version was moved to Trash:\n{logs}"
    );
    assert!(tokio::fs::try_exists(&current_path).await.unwrap());
    assert!(tokio::fs::try_exists(&version_path).await.unwrap());

    sqlx::query("DELETE FROM file_versions WHERE file_id = $1")
        .bind(current_file_id)
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("DELETE FROM files WHERE id = $1")
        .bind(current_file_id)
        .execute(&pool)
        .await
        .unwrap();
}
