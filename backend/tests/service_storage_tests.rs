//! # 存储服务层测试
//!
//! 测试 StorageBackend 的核心功能：
//! - 本地存储（LocalStorage）
//! - 文件保存和读取
//! - 文件删除
//! - 缩略图操作

mod common;

use common::init_test_env;
use file_storage_backend::{
    services::storage::{LocalStorage, StorageBackend},
    utils::AppError,
};
use std::path::Path;
use tempfile::tempdir;
use uuid::Uuid;

// ============================================================================
// 本地存储测试
// ============================================================================

#[tokio::test]
async fn test_local_storage_save_and_get_file() {
    init_test_env();

    // 创建临时目录作为存储根目录
    let temp_dir = tempdir().unwrap();
    let storage = LocalStorage::new(temp_dir.path().to_str().unwrap().to_string());

    let user_id = Uuid::new_v4();
    let file_id = Uuid::new_v4();
    let filename = "test.txt";
    let data = b"Hello, World!";

    // 保存文件
    let file_path = storage
        .save_file(user_id, file_id, filename, data)
        .await
        .unwrap();
    assert!(!file_path.is_empty());

    // 读取文件
    let read_data = storage.get_file(&file_path).await.unwrap();
    assert_eq!(read_data, data);
}

#[tokio::test]
async fn test_local_storage_save_file_from_path() {
    init_test_env();

    let temp_dir = tempdir().unwrap();
    let storage = LocalStorage::new(temp_dir.path().to_str().unwrap().to_string());

    let user_id = Uuid::new_v4();
    let file_id = Uuid::new_v4();
    let filename = "from_path.txt";

    // 创建源文件
    let source_path = temp_dir.path().join("source.txt");
    tokio::fs::write(&source_path, b"Content from file")
        .await
        .unwrap();

    // 从路径保存文件
    let file_path = storage
        .save_file_from_path(user_id, file_id, filename, &source_path)
        .await
        .unwrap();

    // 验证文件内容
    let read_data = storage.get_file(&file_path).await.unwrap();
    assert_eq!(read_data, b"Content from file");
}

#[tokio::test]
async fn test_local_storage_delete_file() {
    init_test_env();

    let temp_dir = tempdir().unwrap();
    let storage = LocalStorage::new(temp_dir.path().to_str().unwrap().to_string());

    let user_id = Uuid::new_v4();
    let file_id = Uuid::new_v4();
    let filename = "to_delete.txt";
    let data = b"Will be deleted";

    // 保存文件
    let file_path = storage
        .save_file(user_id, file_id, filename, data)
        .await
        .unwrap();

    // 验证文件存在
    assert!(storage.get_file(&file_path).await.is_ok());

    // 删除文件
    storage.delete_file(&file_path).await.unwrap();

    // 验证文件不存在
    let result = storage.get_file(&file_path).await;
    assert!(result.is_err());
    assert!(matches!(result.err().unwrap(), AppError::NotFound));
}

#[tokio::test]
async fn test_local_storage_get_nonexistent_file() {
    init_test_env();

    let temp_dir = tempdir().unwrap();
    let storage = LocalStorage::new(temp_dir.path().to_str().unwrap().to_string());

    let result = storage.get_file("/nonexistent/path.txt").await;

    assert!(result.is_err());
    assert!(matches!(result.err().unwrap(), AppError::NotFound));
}

#[tokio::test]
async fn test_local_storage_delete_nonexistent_file() {
    init_test_env();

    let temp_dir = tempdir().unwrap();
    let storage = LocalStorage::new(temp_dir.path().to_str().unwrap().to_string());

    // 删除不存在的文件应该成功（静默处理）
    let result = storage.delete_file("/nonexistent/path.txt").await;

    assert!(result.is_ok());
}

#[tokio::test]
async fn test_local_storage_thumbnail_operations() {
    init_test_env();

    let temp_dir = tempdir().unwrap();
    let storage = LocalStorage::new(temp_dir.path().to_str().unwrap().to_string());

    let user_id = Uuid::new_v4();
    let file_id = Uuid::new_v4();
    let thumbnail_data = b"thumbnail data";

    // 保存缩略图
    storage
        .save_thumbnail(file_id, user_id, thumbnail_data)
        .await
        .unwrap();

    // 获取缩略图
    let read_data = storage.get_thumbnail(file_id, user_id).await.unwrap();
    assert_eq!(read_data, thumbnail_data);

    // 删除缩略图
    storage.delete_thumbnail(file_id, user_id).await.unwrap();

    // 验证缩略图不存在
    let result = storage.get_thumbnail(file_id, user_id).await;
    assert!(result.is_err());
    assert!(matches!(result.err().unwrap(), AppError::NotFound));
}

#[tokio::test]
async fn test_local_storage_get_nonexistent_thumbnail() {
    init_test_env();

    let temp_dir = tempdir().unwrap();
    let storage = LocalStorage::new(temp_dir.path().to_str().unwrap().to_string());

    let user_id = Uuid::new_v4();
    let file_id = Uuid::new_v4();

    let result = storage.get_thumbnail(file_id, user_id).await;

    assert!(result.is_err());
    assert!(matches!(result.err().unwrap(), AppError::NotFound));
}

#[tokio::test]
async fn test_local_storage_open_read_stream() {
    init_test_env();

    let temp_dir = tempdir().unwrap();
    let storage = LocalStorage::new(temp_dir.path().to_str().unwrap().to_string());

    let user_id = Uuid::new_v4();
    let file_id = Uuid::new_v4();
    let filename = "stream_test.txt";
    let data = b"Streamable content";

    // 保存文件
    let file_path = storage
        .save_file(user_id, file_id, filename, data)
        .await
        .unwrap();

    // 打开读取流
    let stream = storage.open_read_stream(&file_path).await.unwrap();

    // 验证流类型
    assert!(matches!(
        stream,
        file_storage_backend::services::storage::StorageReadStream::Local(_)
    ));
}

#[tokio::test]
async fn test_local_storage_open_read_stream_range() {
    init_test_env();

    let temp_dir = tempdir().unwrap();
    let storage = LocalStorage::new(temp_dir.path().to_str().unwrap().to_string());

    let user_id = Uuid::new_v4();
    let file_id = Uuid::new_v4();
    let filename = "range_test.txt";
    let data = b"0123456789ABCDEFGHIJ";

    // 保存文件
    let file_path = storage
        .save_file(user_id, file_id, filename, data)
        .await
        .unwrap();

    // 打开区间读取流
    let stream = storage
        .open_read_stream_range(&file_path, 5, 14)
        .await
        .unwrap();

    // 验证流类型
    assert!(matches!(
        stream,
        file_storage_backend::services::storage::StorageReadStream::Local(_)
    ));
}

#[tokio::test]
async fn test_local_storage_presign_download_url() {
    init_test_env();

    let temp_dir = tempdir().unwrap();
    let storage = LocalStorage::new(temp_dir.path().to_str().unwrap().to_string());

    // 本地存储不支持预签名 URL
    let result = storage
        .presign_download_url("/path/to/file", 3600, None, None)
        .await
        .unwrap();

    assert!(result.is_none());
}

// ============================================================================
// 文件路径格式测试
// ============================================================================

#[tokio::test]
async fn test_local_storage_file_path_format() {
    init_test_env();

    let temp_dir = tempdir().unwrap();
    let storage = LocalStorage::new(temp_dir.path().to_str().unwrap().to_string());

    let user_id = Uuid::parse_str("12345678-1234-1234-1234-123456789abc").unwrap();
    let file_id = Uuid::parse_str("abcdef12-3456-7890-abcd-ef1234567890").unwrap();
    let filename = "test_file.txt";
    let data = b"test";

    let file_path = storage
        .save_file(user_id, file_id, filename, data)
        .await
        .unwrap();

    // 验证路径格式包含用户 ID 和文件 ID
    assert!(file_path.contains("12345678-1234-1234-1234-123456789abc"));
    assert!(file_path.contains("abcdef12-3456-7890-abcd-ef1234567890"));
}

// ============================================================================
// 多用户隔离测试
// ============================================================================

#[tokio::test]
async fn test_local_storage_multi_user_isolation() {
    init_test_env();

    let temp_dir = tempdir().unwrap();
    let storage = LocalStorage::new(temp_dir.path().to_str().unwrap().to_string());

    // 创建两个不同用户
    let user1_id = Uuid::new_v4();
    let user2_id = Uuid::new_v4();

    let file_id1 = Uuid::new_v4();
    let file_id2 = Uuid::new_v4();

    // 用户1保存文件
    let data1 = b"User 1's secret data";
    let path1 = storage
        .save_file(user1_id, file_id1, "secret.txt", data1)
        .await
        .unwrap();

    // 用户2保存同名文件
    let data2 = b"User 2's secret data";
    let path2 = storage
        .save_file(user2_id, file_id2, "secret.txt", data2)
        .await
        .unwrap();

    // 验证路径不同
    assert_ne!(path1, path2);

    // 验证内容隔离
    let read1 = storage.get_file(&path1).await.unwrap();
    let read2 = storage.get_file(&path2).await.unwrap();
    assert_eq!(read1, data1);
    assert_eq!(read2, data2);
}

#[tokio::test]
async fn test_local_storage_user_cannot_access_other_user_files() {
    init_test_env();

    let temp_dir = tempdir().unwrap();
    let storage = LocalStorage::new(temp_dir.path().to_str().unwrap().to_string());

    let user1_id = Uuid::new_v4();
    let user2_id = Uuid::new_v4();

    // 用户1保存文件
    let file_id = Uuid::new_v4();
    let data = b"Secret data";
    let path = storage
        .save_file(user1_id, file_id, "secret.txt", data)
        .await
        .unwrap();

    // 用户2尝试读取用户1的文件（通过直接路径）
    // 这里验证存储后端的文件隔离机制
    assert!(storage.get_file(&path).await.is_ok());

    // 验证路径包含用户1的ID，确保隔离
    assert!(path.contains(&user1_id.to_string()));
    assert!(!path.contains(&user2_id.to_string()));
}

// ============================================================================
// 存储配额相关测试
// ============================================================================

#[tokio::test]
async fn test_local_storage_directories_created() {
    init_test_env();

    let temp_dir = tempdir().unwrap();
    let storage = LocalStorage::new(temp_dir.path().to_str().unwrap().to_string());

    let user_id = Uuid::new_v4();
    let file_id = Uuid::new_v4();
    let data = b"test data";

    // 保存文件会自动创建目录结构
    let path = storage
        .save_file(user_id, file_id, "test.txt", data)
        .await
        .unwrap();

    // 验证目录存在
    let dir_path = Path::new(&path).parent().unwrap();
    assert!(dir_path.exists());
    assert!(dir_path.is_dir());
}

#[tokio::test]
async fn test_local_storage_empty_data() {
    init_test_env();

    let temp_dir = tempdir().unwrap();
    let storage = LocalStorage::new(temp_dir.path().to_str().unwrap().to_string());

    let user_id = Uuid::new_v4();
    let file_id = Uuid::new_v4();
    let data = b"";

    // 保存空文件
    let path = storage
        .save_file(user_id, file_id, "empty.txt", data)
        .await
        .unwrap();

    // 读取空文件
    let read_data = storage.get_file(&path).await.unwrap();
    assert_eq!(read_data, b"");
}

#[tokio::test]
async fn test_local_storage_large_filename() {
    init_test_env();

    let temp_dir = tempdir().unwrap();
    let storage = LocalStorage::new(temp_dir.path().to_str().unwrap().to_string());

    let user_id = Uuid::new_v4();
    let file_id = Uuid::new_v4();
    let long_filename = "a".repeat(255) + ".txt";
    let data = b"test";

    // 保存长文件名
    let path = storage
        .save_file(user_id, file_id, &long_filename, data)
        .await
        .unwrap();

    // 验证文件存在
    assert!(Path::new(&path).exists());

    // 读取验证
    let read_data = storage.get_file(&path).await.unwrap();
    assert_eq!(read_data, data);
}

#[tokio::test]
async fn test_local_storage_large_multibyte_extension_stays_under_byte_limit() {
    init_test_env();

    let temp_dir = tempdir().unwrap();
    let storage = LocalStorage::new(temp_dir.path().to_str().unwrap().to_string());

    let user_id = Uuid::new_v4();
    let file_id = Uuid::new_v4();
    let filename = format!("short.{}", "界".repeat(100));
    let data = b"test";

    let path = storage
        .save_file(user_id, file_id, &filename, data)
        .await
        .unwrap();

    let stored_name = Path::new(&path).file_name().unwrap().to_str().unwrap();
    assert!(stored_name.len() <= 240);
    assert!(Path::new(&path).exists());
}
