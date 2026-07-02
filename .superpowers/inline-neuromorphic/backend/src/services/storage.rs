use async_trait::async_trait;
use percent_encoding::{utf8_percent_encode, AsciiSet, CONTROLS};
use std::io::ErrorKind;
use std::path::{Path, PathBuf};
use uuid::Uuid;

use crate::utils::AppError;

/// 创建内存存储后端（用于测试）
///
/// 使用临时目录创建 LocalStorage，适合集成测试使用
pub fn create_memory_backend() -> LocalStorage {
    let temp_dir = tempfile::tempdir().expect("Failed to create temp directory");
    LocalStorage::new(temp_dir.path().to_string_lossy().to_string())
}

const THUMBNAIL_DIR: &str = ".thumbnails";
const THUMBNAIL_EXT: &str = "jpg";

/// 将 S3 错误映射为 AppError：对象不存在时返回 NotFound(404)，其余为 File 错误。
fn s3_to_app_error<E: std::fmt::Display>(e: &E, op: &str) -> AppError {
    let msg = e.to_string();
    if msg.contains("NoSuchKey") || msg.contains("No Such Key") {
        AppError::NotFound
    } else {
        AppError::File(format!("Failed to {} from S3: {}", op, msg))
    }
}

/// 用于下载/预览的流式读取句柄。
///
/// 说明：我们用枚举把不同后端的“可流式读取源”统一起来：
/// - Local：`tokio::fs::File`
/// - S3：AWS SDK 的 `ByteStream`
pub enum StorageReadStream {
    Local(tokio::fs::File),
    S3(aws_sdk_s3::primitives::ByteStream),
    Memory(std::io::Cursor<Vec<u8>>),
}

const COMPRESSED_TEXT_EXTENSION: &str = "zst";
const TEXT_COMPRESSION_MIN_BYTES: u64 = 1024;
const ZSTD_COMPRESSION_LEVEL: i32 = 3;

pub fn is_storage_path_compressed(file_path: &str) -> bool {
    Path::new(file_path)
        .extension()
        .and_then(|s| s.to_str())
        .is_some_and(|ext| ext.eq_ignore_ascii_case(COMPRESSED_TEXT_EXTENSION))
}

fn append_compression_extension(path: &Path) -> PathBuf {
    let mut value = path.as_os_str().to_os_string();
    value.push(format!(".{}", COMPRESSED_TEXT_EXTENSION));
    PathBuf::from(value)
}

fn append_compression_extension_to_key(key: &str) -> String {
    format!("{}.{}", key, COMPRESSED_TEXT_EXTENSION)
}

fn should_compress_text_asset(filename: &str, size: u64) -> bool {
    if size < TEXT_COMPRESSION_MIN_BYTES || is_storage_path_compressed(filename) {
        return false;
    }

    let lower = filename.to_ascii_lowercase();
    let text_ext = [
        "txt", "md", "markdown", "csv", "tsv", "json", "jsonl", "xml", "yaml", "yml", "toml",
        "log", "sql", "html", "htm", "css", "js", "jsx", "ts", "tsx", "rs", "go", "py", "java",
        "kt", "swift", "c", "h", "cpp", "hpp", "sh", "zsh", "bash",
    ];
    if text_ext
        .iter()
        .any(|ext| lower.ends_with(&format!(".{ext}")))
    {
        return true;
    }

    mime_guess::from_path(filename)
        .first_raw()
        .is_some_and(|mime| {
            mime.starts_with("text/")
                || matches!(
                    mime,
                    "application/json"
                        | "application/xml"
                        | "application/javascript"
                        | "application/x-javascript"
                        | "application/yaml"
                )
        })
}

fn compress_bytes_if_beneficial(filename: &str, data: &[u8]) -> Result<Option<Vec<u8>>, AppError> {
    if !should_compress_text_asset(filename, data.len() as u64) {
        return Ok(None);
    }
    let compressed = zstd::stream::encode_all(data, ZSTD_COMPRESSION_LEVEL)
        .map_err(|e| AppError::Storage(format!("Failed to zstd-compress upload: {}", e)))?;
    if compressed.len() < data.len() {
        Ok(Some(compressed))
    } else {
        Ok(None)
    }
}

fn decompress_storage_bytes(file_path: &str, data: Vec<u8>) -> Result<Vec<u8>, AppError> {
    if !is_storage_path_compressed(file_path) {
        return Ok(data);
    }
    zstd::stream::decode_all(data.as_slice())
        .map_err(|e| AppError::Storage(format!("Failed to zstd-decompress storage object: {}", e)))
}

async fn compress_source_file_if_beneficial(
    source_path: &Path,
    final_path: &Path,
    filename: &str,
) -> Result<Option<PathBuf>, AppError> {
    let source_meta = tokio::fs::metadata(source_path)
        .await
        .map_err(|e| AppError::Storage(format!("Failed to stat source file: {}", e)))?;
    if !should_compress_text_asset(filename, source_meta.len()) {
        return Ok(None);
    }

    let source = source_path.to_path_buf();
    let compressed_path = append_compression_extension(final_path);
    let tmp_path = {
        let mut value = compressed_path.as_os_str().to_os_string();
        value.push(".tmp");
        PathBuf::from(value)
    };

    let result = tokio::task::spawn_blocking(move || -> Result<Option<PathBuf>, AppError> {
        if let Some(parent) = compressed_path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| {
                AppError::Storage(format!("Failed to create compressed parent dir: {}", e))
            })?;
        }

        let mut input = std::fs::File::open(&source)
            .map_err(|e| AppError::Storage(format!("Failed to open source file: {}", e)))?;
        let mut output = std::fs::File::create(&tmp_path)
            .map_err(|e| AppError::Storage(format!("Failed to create compressed file: {}", e)))?;
        zstd::stream::copy_encode(&mut input, &mut output, ZSTD_COMPRESSION_LEVEL)
            .map_err(|e| AppError::Storage(format!("Failed to zstd-compress source: {}", e)))?;
        drop(output);

        let original_size = std::fs::metadata(&source)
            .map_err(|e| AppError::Storage(format!("Failed to stat source file: {}", e)))?
            .len();
        let compressed_size = std::fs::metadata(&tmp_path)
            .map_err(|e| AppError::Storage(format!("Failed to stat compressed file: {}", e)))?
            .len();

        if compressed_size < original_size {
            std::fs::rename(&tmp_path, &compressed_path).map_err(|e| {
                AppError::Storage(format!("Failed to finalize compressed file: {}", e))
            })?;
            let _ = std::fs::remove_file(&source);
            Ok(Some(compressed_path))
        } else {
            let _ = std::fs::remove_file(&tmp_path);
            Ok(None)
        }
    })
    .await
    .map_err(|_| AppError::Storage("Text compression task panicked".to_string()))??;

    Ok(result)
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

    async fn copy_file_to_user(
        &self,
        source_path: &str,
        user_id: Uuid,
        file_id: Uuid,
        filename: &str,
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

    async fn presign_download_url(
        &self,
        file_path: &str,
        expires_secs: u64,
        response_content_type: Option<&str>,
        response_content_disposition: Option<&str>,
    ) -> Result<Option<String>, AppError> {
        let _ = (
            file_path,
            expires_secs,
            response_content_type,
            response_content_disposition,
        );
        Ok(None)
    }

    async fn abort_multipart_upload(
        &self,
        object_key: &str,
        upload_id: &str,
    ) -> Result<bool, AppError> {
        let _ = (object_key, upload_id);
        Ok(false)
    }

    async fn delete_file(&self, file_path: &str) -> Result<(), AppError>;

    /// 读取已生成的缩略图（若存在）。按用户隔离：Local 为 {base}/{user_id}/.thumbnails/{file_id}.jpg，S3 为 {user_id}/.thumbnails/{file_id}.jpg。
    async fn get_thumbnail(&self, file_id: Uuid, user_id: Uuid) -> Result<Vec<u8>, AppError>;

    /// 保存缩略图，按用户隔离存放。
    async fn save_thumbnail(
        &self,
        file_id: Uuid,
        user_id: Uuid,
        data: &[u8],
    ) -> Result<(), AppError>;

    /// 删除缩略图（如原文件删除时）。若本就不存在则忽略。
    async fn delete_thumbnail(&self, file_id: Uuid, user_id: Uuid) -> Result<(), AppError>;

    /// 健康检查
    ///
    /// 验证存储后端是否可用。
    async fn health_check(&self) -> Result<(), AppError>;
}

pub struct LocalStorage {
    base_path: String,
}

const MAX_LOCAL_FILENAME_BYTES: usize = 240;

impl LocalStorage {
    pub fn new(base_path: String) -> Self {
        Self { base_path }
    }

    fn resolve_stored_path(&self, file_path: &str) -> std::path::PathBuf {
        let candidate = std::path::Path::new(file_path);
        if candidate.is_absolute() {
            return candidate.to_path_buf();
        }
        let normalized = file_path.strip_prefix("./").unwrap_or(file_path);
        let base = std::path::Path::new(&self.base_path);
        let base_name = base.file_name().and_then(|s| s.to_str());
        if let Some(base_name) = base_name {
            if normalized.starts_with(&format!("{}/", base_name)) {
                return base.parent().unwrap_or(base).join(normalized);
            }
        }
        base.join(normalized)
    }

    fn local_filename(filename: &str) -> String {
        if filename.len() <= MAX_LOCAL_FILENAME_BYTES {
            return filename.to_string();
        }

        let extension = std::path::Path::new(filename)
            .extension()
            .and_then(|s| s.to_str())
            .map(|s| format!(".{}", s))
            .unwrap_or_default();
        let stem = filename.strip_suffix(&extension).unwrap_or(filename);
        let budget = MAX_LOCAL_FILENAME_BYTES.saturating_sub(extension.len());

        let truncated = Self::truncate_utf8_to_bytes(stem, budget);

        if truncated.is_empty() {
            Self::truncate_utf8_to_bytes(filename, MAX_LOCAL_FILENAME_BYTES)
        } else {
            format!("{}{}", truncated, extension)
        }
    }

    fn truncate_utf8_to_bytes(value: &str, max_bytes: usize) -> String {
        match value
            .char_indices()
            .find(|&(idx, ch)| idx + ch.len_utf8() > max_bytes)
        {
            Some((idx, _)) => value[..idx].to_string(),
            None => value.to_string(),
        }
    }

    fn get_file_path(&self, user_id: Uuid, file_id: Uuid, filename: &str) -> std::path::PathBuf {
        let filename = Self::local_filename(filename);
        Path::new(&self.base_path)
            .join(user_id.to_string())
            .join(file_id.to_string())
            .join(filename)
    }

    fn get_thumbnail_path(&self, file_id: Uuid, user_id: Uuid) -> std::path::PathBuf {
        Path::new(&self.base_path)
            .join(user_id.to_string())
            .join(THUMBNAIL_DIR)
            .join(format!("{}.{}", file_id, "webp"))
    }

    /// 旧版缩略图路径（迁移前：根目录下 .thumbnails/{file_id}.jpg）
    fn get_thumbnail_path_legacy(&self, file_id: Uuid) -> std::path::PathBuf {
        Path::new(&self.base_path)
            .join(THUMBNAIL_DIR)
            .join(format!("{}.{}", file_id, THUMBNAIL_EXT))
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

        let (target_path, bytes) =
            if let Some(compressed) = compress_bytes_if_beneficial(filename, data)? {
                (append_compression_extension(&file_path), compressed)
            } else {
                (file_path, data.to_vec())
            };

        tokio::fs::write(&target_path, bytes)
            .await
            .map_err(|e| AppError::Storage(format!("Failed to write file: {}", e)))?;

        Ok(target_path.to_string_lossy().to_string())
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

        if let Some(compressed_path) =
            compress_source_file_if_beneficial(source_path, &file_path, filename).await?
        {
            return Ok(compressed_path.to_string_lossy().to_string());
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
        let path = self.resolve_stored_path(file_path);
        let data = tokio::fs::read(path).await.map_err(|e| {
            if e.kind() == ErrorKind::NotFound {
                AppError::NotFound
            } else {
                AppError::File(format!("Failed to read file: {}", e))
            }
        })?;
        decompress_storage_bytes(file_path, data)
    }

    async fn copy_file_to_user(
        &self,
        source_path: &str,
        user_id: Uuid,
        file_id: Uuid,
        filename: &str,
    ) -> Result<String, AppError> {
        let source = self.resolve_stored_path(source_path);
        let file_path = self.get_file_path(user_id, file_id, filename);

        if let Some(parent) = file_path.parent() {
            tokio::fs::create_dir_all(parent)
                .await
                .map_err(|e| AppError::Storage(format!("Failed to create directory: {}", e)))?;
        }

        tokio::fs::copy(&source, &file_path).await.map_err(|e| {
            if e.kind() == ErrorKind::NotFound {
                AppError::NotFound
            } else {
                AppError::Storage(format!("Failed to copy file into storage: {}", e))
            }
        })?;

        Ok(file_path.to_string_lossy().to_string())
    }

    async fn open_read_stream(&self, file_path: &str) -> Result<StorageReadStream, AppError> {
        if is_storage_path_compressed(file_path) {
            let data = self.get_file(file_path).await?;
            return Ok(StorageReadStream::Memory(std::io::Cursor::new(data)));
        }
        let path = self.resolve_stored_path(file_path);
        let file = tokio::fs::File::open(&path).await.map_err(|e| {
            if e.kind() == ErrorKind::NotFound {
                AppError::NotFound
            } else {
                AppError::File(format!("Failed to open file {}: {}", path.display(), e))
            }
        })?;
        Ok(StorageReadStream::Local(file))
    }

    async fn open_read_stream_range(
        &self,
        file_path: &str,
        _start: u64,
        _end_inclusive: u64,
    ) -> Result<StorageReadStream, AppError> {
        if is_storage_path_compressed(file_path) {
            let data = self.get_file(file_path).await?;
            return Ok(StorageReadStream::Memory(std::io::Cursor::new(data)));
        }
        // Local：区间读取在 handler 里完成（seek + take）
        self.open_read_stream(file_path).await
    }

    async fn delete_file(&self, file_path: &str) -> Result<(), AppError> {
        let path = self.resolve_stored_path(file_path);
        match tokio::fs::remove_file(&path).await {
            Ok(()) => {}
            Err(e) if e.kind() == ErrorKind::NotFound => return Ok(()),
            Err(e) => return Err(AppError::File(format!("Failed to delete file: {}", e))),
        }

        // Try to remove empty directories
        if let Some(parent) = path.parent() {
            let _ = tokio::fs::remove_dir(parent).await;
            if let Some(grandparent) = parent.parent() {
                let _ = tokio::fs::remove_dir(grandparent).await;
            }
        }

        Ok(())
    }

    async fn get_thumbnail(&self, file_id: Uuid, user_id: Uuid) -> Result<Vec<u8>, AppError> {
        let path = self.get_thumbnail_path(file_id, user_id);
        match tokio::fs::read(&path).await {
            Ok(data) => Ok(data),
            Err(e) if e.kind() == ErrorKind::NotFound => {
                // 兼容：之前已生成的缩略图在根目录 .thumbnails/ 下，读时迁移到按用户路径
                let legacy = self.get_thumbnail_path_legacy(file_id);
                let data = tokio::fs::read(&legacy).await.map_err(|e| {
                    if e.kind() == ErrorKind::NotFound {
                        AppError::NotFound
                    } else {
                        AppError::File(format!("Failed to read thumbnail: {}", e))
                    }
                })?;
                let _ = self.save_thumbnail(file_id, user_id, &data).await;
                let _ = tokio::fs::remove_file(&legacy).await;
                tracing::info!(
                    backend = "local",
                    file_id = %file_id,
                    user_id = %user_id,
                    "thumbnail migrated from legacy path to per-user path"
                );
                Ok(data)
            }
            Err(e) => Err(AppError::File(format!("Failed to read thumbnail: {}", e))),
        }
    }

    async fn save_thumbnail(
        &self,
        file_id: Uuid,
        user_id: Uuid,
        data: &[u8],
    ) -> Result<(), AppError> {
        let path = self.get_thumbnail_path(file_id, user_id);
        if let Some(parent) = path.parent() {
            tokio::fs::create_dir_all(parent)
                .await
                .map_err(|e| AppError::Storage(format!("Failed to create thumbnail dir: {}", e)))?;
        }
        tokio::fs::write(&path, data)
            .await
            .map_err(|e| AppError::Storage(format!("Failed to write thumbnail: {}", e)))?;
        Ok(())
    }

    async fn delete_thumbnail(&self, file_id: Uuid, user_id: Uuid) -> Result<(), AppError> {
        let path = self.get_thumbnail_path(file_id, user_id);
        if let Err(e) = tokio::fs::remove_file(&path).await {
            if e.kind() != ErrorKind::NotFound {
                return Err(AppError::File(format!("Failed to delete thumbnail: {}", e)));
            }
        }
        Ok(())
    }

    async fn health_check(&self) -> Result<(), AppError> {
        // 检查存储目录是否可访问
        let path = Path::new(&self.base_path);
        if !path.exists() {
            return Err(AppError::Storage(
                "Storage directory does not exist".to_string(),
            ));
        }
        if !path.is_dir() {
            return Err(AppError::Storage(
                "Storage path is not a directory".to_string(),
            ));
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
    const COPY_SOURCE_ENCODE_SET: &'static AsciiSet = &CONTROLS
        .add(b' ')
        .add(b'"')
        .add(b'#')
        .add(b'%')
        .add(b'<')
        .add(b'>')
        .add(b'?')
        .add(b'`')
        .add(b'{')
        .add(b'}');

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

    fn get_thumbnail_key(&self, file_id: Uuid, user_id: Uuid) -> String {
        format!("{}/{}/{}.webp", user_id, THUMBNAIL_DIR, file_id)
    }

    fn get_thumbnail_key_legacy(&self, file_id: Uuid) -> String {
        format!("{}/{}.{}", THUMBNAIL_DIR, file_id, THUMBNAIL_EXT)
    }

    fn copy_source_header(bucket: &str, source_path: &str) -> String {
        let source_path = utf8_percent_encode(source_path, Self::COPY_SOURCE_ENCODE_SET);
        format!("{}/{}", bucket, source_path)
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
        let (key, body) = if let Some(compressed) = compress_bytes_if_beneficial(filename, data)? {
            (
                append_compression_extension_to_key(&key),
                aws_sdk_s3::primitives::ByteStream::from(compressed),
            )
        } else {
            (key, aws_sdk_s3::primitives::ByteStream::from(data.to_vec()))
        };

        self.client
            .put_object()
            .bucket(&self.bucket)
            .key(&key)
            .body(body)
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
        let upload_source;
        let key = if let Some(compressed_path) =
            compress_source_file_if_beneficial(source_path, Path::new(source_path), filename)
                .await?
        {
            upload_source = compressed_path;
            append_compression_extension_to_key(&key)
        } else {
            upload_source = source_path.to_path_buf();
            key
        };

        let body = aws_sdk_s3::primitives::ByteStream::from_path(upload_source.clone())
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

        // best-effort 清理：S3 已接管数据后，尽量删除本地临时源文件以节省磁盘空间
        let _ = tokio::fs::remove_file(source_path).await;
        if upload_source != source_path {
            let _ = tokio::fs::remove_file(upload_source).await;
        }

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
            .map_err(|e| s3_to_app_error(&e, "get file"))?;

        let data = response
            .body
            .collect()
            .await
            .map_err(|e| AppError::File(format!("Failed to read S3 object: {}", e)))?;

        decompress_storage_bytes(file_path, data.to_vec())
    }

    async fn copy_file_to_user(
        &self,
        source_path: &str,
        user_id: Uuid,
        file_id: Uuid,
        filename: &str,
    ) -> Result<String, AppError> {
        let key = self.get_s3_key(user_id, file_id, filename);
        let copy_source = Self::copy_source_header(&self.bucket, source_path);

        self.client
            .copy_object()
            .bucket(&self.bucket)
            .copy_source(copy_source)
            .key(&key)
            .send()
            .await
            .map_err(|e| AppError::Storage(format!("Failed to copy S3 object: {}", e)))?;

        Ok(key)
    }

    async fn open_read_stream(&self, file_path: &str) -> Result<StorageReadStream, AppError> {
        if is_storage_path_compressed(file_path) {
            let data = self.get_file(file_path).await?;
            return Ok(StorageReadStream::Memory(std::io::Cursor::new(data)));
        }
        let response = self
            .client
            .get_object()
            .bucket(&self.bucket)
            .key(file_path)
            .send()
            .await
            .map_err(|e| s3_to_app_error(&e, "open stream"))?;

        Ok(StorageReadStream::S3(response.body))
    }

    async fn open_read_stream_range(
        &self,
        file_path: &str,
        start: u64,
        end_inclusive: u64,
    ) -> Result<StorageReadStream, AppError> {
        if is_storage_path_compressed(file_path) {
            let data = self.get_file(file_path).await?;
            return Ok(StorageReadStream::Memory(std::io::Cursor::new(data)));
        }
        let range = format!("bytes={}-{}", start, end_inclusive);
        let response = self
            .client
            .get_object()
            .bucket(&self.bucket)
            .key(file_path)
            .range(range)
            .send()
            .await
            .map_err(|e| s3_to_app_error(&e, "get ranged file"))?;

        Ok(StorageReadStream::S3(response.body))
    }

    async fn presign_download_url(
        &self,
        file_path: &str,
        expires_secs: u64,
        response_content_type: Option<&str>,
        response_content_disposition: Option<&str>,
    ) -> Result<Option<String>, AppError> {
        use aws_sdk_s3::presigning::PresigningConfig;
        use std::time::Duration;

        let mut req = self.client.get_object().bucket(&self.bucket).key(file_path);

        if let Some(v) = response_content_type {
            req = req.response_content_type(v);
        }
        if let Some(v) = response_content_disposition {
            req = req.response_content_disposition(v);
        }

        let cfg = PresigningConfig::expires_in(Duration::from_secs(expires_secs))
            .map_err(|e| AppError::Storage(format!("Invalid presign ttl: {}", e)))?;
        let presigned = req
            .presigned(cfg)
            .await
            .map_err(|e| AppError::Storage(format!("Failed to presign S3 url: {}", e)))?;
        Ok(Some(presigned.uri().to_string()))
    }

    async fn abort_multipart_upload(
        &self,
        object_key: &str,
        upload_id: &str,
    ) -> Result<bool, AppError> {
        self.client
            .abort_multipart_upload()
            .bucket(&self.bucket)
            .key(object_key)
            .upload_id(upload_id)
            .send()
            .await
            .map_err(|e| {
                AppError::Storage(format!("Failed to abort S3 multipart upload: {}", e))
            })?;
        Ok(true)
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

    async fn get_thumbnail(&self, file_id: Uuid, user_id: Uuid) -> Result<Vec<u8>, AppError> {
        let key = self.get_thumbnail_key(file_id, user_id);
        let response = self
            .client
            .get_object()
            .bucket(&self.bucket)
            .key(&key)
            .send()
            .await;
        match response {
            Ok(resp) => {
                let data = resp
                    .body
                    .collect()
                    .await
                    .map_err(|e| AppError::File(format!("Failed to read thumbnail: {}", e)))?;
                Ok(data.to_vec())
            }
            Err(e) => {
                let msg = e.to_string();
                let is_not_found = msg.contains("NoSuchKey") || msg.contains("No Such Key");
                if !is_not_found {
                    return Err(s3_to_app_error(&e, "get thumbnail"));
                }
                // 兼容：旧版缩略图在 .thumbnails/{file_id}.jpg，读时迁移到按用户路径
                let legacy_key = self.get_thumbnail_key_legacy(file_id);
                let legacy_resp = self
                    .client
                    .get_object()
                    .bucket(&self.bucket)
                    .key(&legacy_key)
                    .send()
                    .await
                    .map_err(|e| s3_to_app_error(&e, "get thumbnail (legacy)"))?;
                let data = legacy_resp
                    .body
                    .collect()
                    .await
                    .map_err(|e| AppError::File(format!("Failed to read thumbnail: {}", e)))?;
                let data = data.to_vec();
                let _ = self.save_thumbnail(file_id, user_id, &data).await;
                let _ = self
                    .client
                    .delete_object()
                    .bucket(&self.bucket)
                    .key(&legacy_key)
                    .send()
                    .await;
                tracing::info!(
                    backend = "s3",
                    file_id = %file_id,
                    user_id = %user_id,
                    "thumbnail migrated from legacy key to per-user key"
                );
                Ok(data)
            }
        }
    }

    async fn save_thumbnail(
        &self,
        file_id: Uuid,
        user_id: Uuid,
        data: &[u8],
    ) -> Result<(), AppError> {
        let key = self.get_thumbnail_key(file_id, user_id);
        self.client
            .put_object()
            .bucket(&self.bucket)
            .key(&key)
            .content_type("image/webp")
            .body(aws_sdk_s3::primitives::ByteStream::from(data.to_vec()))
            .send()
            .await
            .map_err(|e| AppError::Storage(format!("Failed to save thumbnail to S3: {}", e)))?;
        Ok(())
    }

    async fn delete_thumbnail(&self, file_id: Uuid, user_id: Uuid) -> Result<(), AppError> {
        let key = self.get_thumbnail_key(file_id, user_id);
        if let Err(e) = self
            .client
            .delete_object()
            .bucket(&self.bucket)
            .key(&key)
            .send()
            .await
        {
            let msg = e.to_string();
            if !msg.contains("NoSuchKey") && !msg.contains("No Such Key") {
                return Err(AppError::File(format!(
                    "Failed to delete thumbnail from S3: {}",
                    e
                )));
            }
        }
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

#[cfg(test)]
mod tests {
    use super::S3Storage;

    #[test]
    fn s3_copy_source_url_encodes_object_key() {
        assert_eq!(
            S3Storage::copy_source_header("uploads", "user/a b/#report?中文%.txt"),
            "uploads/user/a%20b/%23report%3F%E4%B8%AD%E6%96%87%25.txt"
        );
    }
}
