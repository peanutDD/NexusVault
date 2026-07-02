//! 下载分发回归测试。

mod common;

use std::sync::Arc;

use async_trait::async_trait;
use axum::{
    body::Body,
    http::{header, Request, StatusCode},
};
use common::{
    app::{bearer_auth_header, login_and_get_token},
    cleanup_test_data, create_test_pool, init_test_env,
};
use file_storage_backend::{
    app::create_app,
    config::Config,
    services::storage::{StorageBackend, StorageReadStream},
    AppState,
};
use tower::ServiceExt;
use uuid::Uuid;

#[derive(Default)]
struct FakePresignedStorage;

#[async_trait]
impl StorageBackend for FakePresignedStorage {
    async fn save_file(
        &self,
        _user_id: Uuid,
        _file_id: Uuid,
        _filename: &str,
        _data: &[u8],
    ) -> Result<String, file_storage_backend::utils::AppError> {
        unimplemented!("not used")
    }

    async fn save_file_from_path(
        &self,
        _user_id: Uuid,
        _file_id: Uuid,
        _filename: &str,
        _source_path: &std::path::Path,
    ) -> Result<String, file_storage_backend::utils::AppError> {
        unimplemented!("not used")
    }

    async fn copy_file_to_user(
        &self,
        _source_path: &str,
        _user_id: Uuid,
        _file_id: Uuid,
        _filename: &str,
    ) -> Result<String, file_storage_backend::utils::AppError> {
        unimplemented!("not used")
    }

    async fn get_file(
        &self,
        _file_path: &str,
    ) -> Result<Vec<u8>, file_storage_backend::utils::AppError> {
        Ok(b"hello".to_vec())
    }

    async fn open_read_stream(
        &self,
        _file_path: &str,
    ) -> Result<StorageReadStream, file_storage_backend::utils::AppError> {
        Ok(StorageReadStream::Memory(std::io::Cursor::new(
            b"hello".to_vec(),
        )))
    }

    async fn open_read_stream_range(
        &self,
        _file_path: &str,
        _start: u64,
        _end_inclusive: u64,
    ) -> Result<StorageReadStream, file_storage_backend::utils::AppError> {
        self.open_read_stream(_file_path).await
    }

    async fn presign_download_url(
        &self,
        file_path: &str,
        _expires_secs: u64,
        _response_content_type: Option<&str>,
        _response_content_disposition: Option<&str>,
    ) -> Result<Option<String>, file_storage_backend::utils::AppError> {
        Ok(Some(format!("https://cdn.example.test/{file_path}?sig=ok")))
    }

    async fn delete_file(
        &self,
        _file_path: &str,
    ) -> Result<(), file_storage_backend::utils::AppError> {
        Ok(())
    }

    async fn get_thumbnail(
        &self,
        _file_id: Uuid,
        _user_id: Uuid,
    ) -> Result<Vec<u8>, file_storage_backend::utils::AppError> {
        unimplemented!("not used")
    }

    async fn save_thumbnail(
        &self,
        _file_id: Uuid,
        _user_id: Uuid,
        _data: &[u8],
    ) -> Result<(), file_storage_backend::utils::AppError> {
        unimplemented!("not used")
    }

    async fn delete_thumbnail(
        &self,
        _file_id: Uuid,
        _user_id: Uuid,
    ) -> Result<(), file_storage_backend::utils::AppError> {
        unimplemented!("not used")
    }

    async fn health_check(&self) -> Result<(), file_storage_backend::utils::AppError> {
        Ok(())
    }
}

#[tokio::test]
async fn presigned_download_mode_returns_302_for_uncompressed_objects() {
    init_test_env();
    let pool = create_test_pool().await;
    cleanup_test_data(&pool).await;
    let (user_id, token) = login_and_get_token(&pool, "download_presigned").await;

    let file_id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO files
         (id, user_id, filename, original_filename, file_path, file_size, mime_type, storage_backend)
         VALUES ($1, $2, 'report.txt', 'report.txt', 'objects/report.txt', 5, 'text/plain', 's3')",
    )
    .bind(file_id)
    .bind(user_id)
    .execute(&pool)
    .await
    .unwrap();

    let mut config = Config::default_for_test();
    config.storage.download_mode = "presigned".to_string();
    config.storage.backend = "s3".to_string();
    let config = Arc::new(config);
    let state = AppState::new(
        config.clone(),
        pool.clone(),
        pool.clone(),
        Arc::new(FakePresignedStorage),
        None,
    );
    let app = create_app(state, config.as_ref(), || "".to_string()).await;
    let (name, value) = bearer_auth_header(&token);

    let response = app
        .oneshot(
            Request::builder()
                .uri(format!("/api/v1/files/{file_id}/download"))
                .header(name, value)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::FOUND);
    assert_eq!(
        response.headers().get(header::LOCATION).unwrap(),
        "https://cdn.example.test/objects/report.txt?sig=ok"
    );
}

#[tokio::test]
async fn presigned_download_mode_proxies_compressed_storage_objects() {
    init_test_env();
    let pool = create_test_pool().await;
    cleanup_test_data(&pool).await;
    let (user_id, token) = login_and_get_token(&pool, "download_compressed_proxy").await;

    let file_id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO files
         (id, user_id, filename, original_filename, file_path, file_size, mime_type, storage_backend)
         VALUES ($1, $2, 'report.txt', 'report.txt', 'objects/report.txt.zst', 5, 'text/plain', 's3')",
    )
    .bind(file_id)
    .bind(user_id)
    .execute(&pool)
    .await
    .unwrap();

    let mut config = Config::default_for_test();
    config.storage.download_mode = "presigned".to_string();
    config.storage.backend = "s3".to_string();
    let config = Arc::new(config);
    let state = AppState::new(
        config.clone(),
        pool.clone(),
        pool.clone(),
        Arc::new(FakePresignedStorage),
        None,
    );
    let app = create_app(state, config.as_ref(), || "".to_string()).await;
    let (name, value) = bearer_auth_header(&token);

    let response = app
        .oneshot(
            Request::builder()
                .uri(format!("/api/v1/files/{file_id}/download"))
                .header(name, value)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    assert!(response.headers().get(header::LOCATION).is_none());
}
