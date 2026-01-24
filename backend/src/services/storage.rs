use async_trait::async_trait;
use std::path::Path;
use uuid::Uuid;

use crate::utils::AppError;

#[async_trait]
pub trait StorageBackend: Send + Sync {
    async fn save_file(
        &self,
        user_id: Uuid,
        file_id: Uuid,
        filename: &str,
        data: &[u8],
    ) -> Result<String, AppError>;

    async fn get_file(&self, file_path: &str) -> Result<Vec<u8>, AppError>;

    async fn delete_file(&self, file_path: &str) -> Result<(), AppError>;
}

pub struct LocalStorage {
    base_path: String,
}

impl LocalStorage {
    pub fn new(base_path: String) -> Self {
        Self { base_path }
    }

    fn get_file_path(&self, user_id: Uuid, file_id: Uuid, filename: &str) -> std::path::PathBuf {
        Path::new(&self.base_path)
            .join(user_id.to_string())
            .join(file_id.to_string())
            .join(filename)
    }
}

#[async_trait]
impl StorageBackend for LocalStorage {
    async fn save_file(
        &self,
        user_id: Uuid,
        file_id: Uuid,
        filename: &str,
        data: &[u8],
    ) -> Result<String, AppError> {
        let file_path = self.get_file_path(user_id, file_id, filename);

        // Create directory if it doesn't exist
        if let Some(parent) = file_path.parent() {
            tokio::fs::create_dir_all(parent)
                .await
                .map_err(|e| AppError::Storage(format!("Failed to create directory: {}", e)))?;
        }

        // Write file
        tokio::fs::write(&file_path, data)
            .await
            .map_err(|e| AppError::Storage(format!("Failed to write file: {}", e)))?;

        Ok(file_path.to_string_lossy().to_string())
    }

    async fn get_file(&self, file_path: &str) -> Result<Vec<u8>, AppError> {
        let path = Path::new(file_path);
        tokio::fs::read(path)
            .await
            .map_err(|e| AppError::File(format!("Failed to read file: {}", e)))
    }

    async fn delete_file(&self, file_path: &str) -> Result<(), AppError> {
        let path = Path::new(file_path);
        tokio::fs::remove_file(path)
            .await
            .map_err(|e| AppError::File(format!("Failed to delete file: {}", e)))?;

        // Try to remove empty directories
        if let Some(parent) = path.parent() {
            let _ = tokio::fs::remove_dir(parent).await;
            if let Some(grandparent) = parent.parent() {
                let _ = tokio::fs::remove_dir(grandparent).await;
            }
        }

        Ok(())
    }
}

pub struct S3Storage {
    bucket: String,
    _region: String,
    client: aws_sdk_s3::Client,
}

impl S3Storage {
    pub async fn new(bucket: String, region: String) -> Result<Self, AppError> {
        let config = aws_config::load_defaults(aws_config::BehaviorVersion::latest()).await;
        let client = aws_sdk_s3::Client::new(&config);

        Ok(Self {
            bucket,
            _region: region,
            client,
        })
    }

    fn get_s3_key(&self, user_id: Uuid, file_id: Uuid, filename: &str) -> String {
        format!("{}/{}/{}", user_id, file_id, filename)
    }
}

#[async_trait]
impl StorageBackend for S3Storage {
    async fn save_file(
        &self,
        user_id: Uuid,
        file_id: Uuid,
        filename: &str,
        data: &[u8],
    ) -> Result<String, AppError> {
        let key = self.get_s3_key(user_id, file_id, filename);

        self.client
            .put_object()
            .bucket(&self.bucket)
            .key(&key)
            .body(aws_sdk_s3::primitives::ByteStream::from(data.to_vec()))
            .send()
            .await
            .map_err(|e| AppError::Storage(format!("Failed to upload to S3: {}", e)))?;

        Ok(key)
    }

    async fn get_file(&self, file_path: &str) -> Result<Vec<u8>, AppError> {
        let response = self
            .client
            .get_object()
            .bucket(&self.bucket)
            .key(file_path)
            .send()
            .await
            .map_err(|e| AppError::File(format!("Failed to get file from S3: {}", e)))?;

        let data = response
            .body
            .collect()
            .await
            .map_err(|e| AppError::File(format!("Failed to read S3 object: {}", e)))?;

        Ok(data.to_vec())
    }

    async fn delete_file(&self, file_path: &str) -> Result<(), AppError> {
        self.client
            .delete_object()
            .bucket(&self.bucket)
            .key(file_path)
            .send()
            .await
            .map_err(|e| AppError::File(format!("Failed to delete file from S3: {}", e)))?;

        Ok(())
    }
}

#[allow(dead_code)]
pub fn create_storage_backend(
    backend_type: &str,
    storage_path: String,
    _aws_bucket: String,
    _aws_region: String,
) -> Result<Box<dyn StorageBackend>, AppError> {
    match backend_type {
        "local" => Ok(Box::new(LocalStorage::new(storage_path))),
        "s3" => {
            // Note: S3Storage::new is async, so we can't call it here
            // In production, you'd initialize it differently
            Err(AppError::Storage(
                "S3 storage must be initialized asynchronously".to_string(),
            ))
        }
        _ => Err(AppError::Storage(format!(
            "Unknown storage backend: {}",
            backend_type
        ))),
    }
}
