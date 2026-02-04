use async_trait::async_trait;
use std::path::Path;
use uuid::Uuid;

use crate::utils::AppError;

/// 用于下载/预览的流式读取句柄。
///
/// 说明：我们用枚举把不同后端的“可流式读取源”统一起来：
/// - Local：`tokio::fs::File`
/// - S3：AWS SDK 的 `ByteStream`
pub enum StorageReadStream {
    Local(tokio::fs::File),
    S3(aws_sdk_s3::primitives::ByteStream),
}

#[async_trait]
pub trait StorageBackend: Send + Sync {
    async fn save_file(
        &self,
        user_id: Uuid,
        file_id: Uuid,
        filename: &str,
        data: &[u8],
    ) -> Result<String, AppError>;

    /// 从本地文件路径保存文件（尽量避免把整个文件读入内存）。
    ///
    /// - Local: 优先使用 rename，失败则 copy+delete 兜底
    /// - S3: 使用 SDK 的 ByteStream::from_path 进行流式上传
    async fn save_file_from_path(
        &self,
        user_id: Uuid,
        file_id: Uuid,
        filename: &str,
        source_path: &Path,
    ) -> Result<String, AppError>;

    async fn get_file(&self, file_path: &str) -> Result<Vec<u8>, AppError>;

    /// 打开一个用于下载/预览的流式读取源（避免一次性读入内存）。
    async fn open_read_stream(&self, file_path: &str) -> Result<StorageReadStream, AppError>;

    /// 打开一个用于下载/预览的“区间读取”流（Range 请求）。
    ///
    /// - Local：返回从 0 开始的文件句柄（区间读取可在 handler 里 seek + take）
    /// - S3：使用 `Range: bytes=start-end` 让对象存储侧只返回需要的区间
    async fn open_read_stream_range(
        &self,
        file_path: &str,
        start: u64,
        end_inclusive: u64,
    ) -> Result<StorageReadStream, AppError>;

    async fn delete_file(&self, file_path: &str) -> Result<(), AppError>;

    /// 健康检查
    ///
    /// 验证存储后端是否可用。
    async fn health_check(&self) -> Result<(), AppError>;
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

    async fn save_file_from_path(
        &self,
        user_id: Uuid,
        file_id: Uuid,
        filename: &str,
        source_path: &Path,
    ) -> Result<String, AppError> {
        let file_path = self.get_file_path(user_id, file_id, filename);

        // Create directory if it doesn't exist
        if let Some(parent) = file_path.parent() {
            tokio::fs::create_dir_all(parent)
                .await
                .map_err(|e| AppError::Storage(format!("Failed to create directory: {}", e)))?;
        }

        // Try fast path: atomic rename (same filesystem)
        match tokio::fs::rename(source_path, &file_path).await {
            Ok(()) => Ok(file_path.to_string_lossy().to_string()),
            Err(rename_err) => {
                // Fallback: copy then delete source
                tokio::fs::copy(source_path, &file_path)
                    .await
                    .map_err(|e| {
                        AppError::Storage(format!(
                            "Failed to copy file into storage (rename_err={}): {}",
                            rename_err, e
                        ))
                    })?;
                let _ = tokio::fs::remove_file(source_path).await;
                Ok(file_path.to_string_lossy().to_string())
            }
        }
    }

    async fn get_file(&self, file_path: &str) -> Result<Vec<u8>, AppError> {
        let path = Path::new(file_path);
        tokio::fs::read(path)
            .await
            .map_err(|e| AppError::File(format!("Failed to read file: {}", e)))
    }

    async fn open_read_stream(&self, file_path: &str) -> Result<StorageReadStream, AppError> {
        let path = Path::new(file_path);
        let file = tokio::fs::File::open(path)
            .await
            .map_err(|e| AppError::File(format!("Failed to open file: {}", e)))?;
        Ok(StorageReadStream::Local(file))
    }

    async fn open_read_stream_range(
        &self,
        file_path: &str,
        _start: u64,
        _end_inclusive: u64,
    ) -> Result<StorageReadStream, AppError> {
        // Local：区间读取在 handler 里完成（seek + take）
        self.open_read_stream(file_path).await
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

    async fn health_check(&self) -> Result<(), AppError> {
        // 检查存储目录是否可访问
        let path = Path::new(&self.base_path);
        if !path.exists() {
            return Err(AppError::Storage("Storage directory does not exist".to_string()));
        }
        if !path.is_dir() {
            return Err(AppError::Storage("Storage path is not a directory".to_string()));
        }
        // 尝试创建一个临时文件验证写入权限
        let test_file = path.join(".health_check");
        tokio::fs::write(&test_file, b"health")
            .await
            .map_err(|e| AppError::Storage(format!("Storage not writable: {}", e)))?;
        let _ = tokio::fs::remove_file(&test_file).await;
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

    async fn save_file_from_path(
        &self,
        user_id: Uuid,
        file_id: Uuid,
        filename: &str,
        source_path: &Path,
    ) -> Result<String, AppError> {
        let key = self.get_s3_key(user_id, file_id, filename);

        let body = aws_sdk_s3::primitives::ByteStream::from_path(source_path.to_path_buf())
            .await
            .map_err(|e| AppError::Storage(format!("Failed to read file for S3 upload: {}", e)))?;

        self.client
            .put_object()
            .bucket(&self.bucket)
            .key(&key)
            .body(body)
            .send()
            .await
            .map_err(|e| AppError::Storage(format!("Failed to upload to S3: {}", e)))?;

        // Best-effort cleanup of the local source file
        let _ = tokio::fs::remove_file(source_path).await;

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

    async fn open_read_stream(&self, file_path: &str) -> Result<StorageReadStream, AppError> {
        let response = self
            .client
            .get_object()
            .bucket(&self.bucket)
            .key(file_path)
            .send()
            .await
            .map_err(|e| AppError::File(format!("Failed to get file from S3: {}", e)))?;

        Ok(StorageReadStream::S3(response.body))
    }

    async fn open_read_stream_range(
        &self,
        file_path: &str,
        start: u64,
        end_inclusive: u64,
    ) -> Result<StorageReadStream, AppError> {
        let range = format!("bytes={}-{}", start, end_inclusive);
        let response = self
            .client
            .get_object()
            .bucket(&self.bucket)
            .key(file_path)
            .range(range)
            .send()
            .await
            .map_err(|e| AppError::File(format!("Failed to get ranged file from S3: {}", e)))?;

        Ok(StorageReadStream::S3(response.body))
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

    async fn health_check(&self) -> Result<(), AppError> {
        // 检查 S3 bucket 是否可访问
        self.client
            .head_bucket()
            .bucket(&self.bucket)
            .send()
            .await
            .map_err(|e| AppError::Storage(format!("S3 bucket not accessible: {}", e)))?;
        Ok(())
    }
}
