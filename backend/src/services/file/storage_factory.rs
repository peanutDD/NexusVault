//! 存储后端工厂（Local / S3）

use std::sync::Arc;

use crate::config::Config;
use crate::services::storage::{LocalStorage, S3Storage, StorageBackend};
use crate::utils::AppError;

pub async fn create_storage(config: Arc<Config>) -> Result<Arc<dyn StorageBackend>, AppError> {
    match config.storage.backend.as_str() {
        "local" => {
            // 显式上转为 trait object，避免 match 分支类型推断不一致
            let storage: Arc<dyn StorageBackend> =
                Arc::new(LocalStorage::new(config.storage.path.clone()));
            Ok(storage)
        }
        "s3" => {
            let bucket = config.storage.aws_bucket.clone().ok_or_else(|| {
                AppError::Storage("AWS S3 bucket is not configured".to_string())
            })?;
            let region = config.storage.aws_region.clone().ok_or_else(|| {
                AppError::Storage("AWS S3 region is not configured".to_string())
            })?;
            let s3_storage = S3Storage::new(bucket, region).await?;
            // 显式上转为 trait object，避免 match 分支类型推断不一致
            let storage: Arc<dyn StorageBackend> = Arc::new(s3_storage);
            Ok(storage)
        }
        _ => Err(AppError::Storage(format!(
            "Unknown storage backend: {}",
            config.storage.backend
        ))),
    }
}
