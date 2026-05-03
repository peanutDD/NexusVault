//! # 文件服务层测试
//!
//! 测试 FileService 的核心业务逻辑：
//! - 文件重命名
//! - 文件列表查询
//! - 文件删除
//! - 存储配额检查

mod common;

use std::sync::Arc;

use bytes::Bytes;
use common::{
    cleanup_test_data, create_test_file, create_test_pool, create_test_user, init_test_env,
};
use file_storage_backend::{
    config::Config,
    constants::CHUNK_SIZE,
    models::file::{FileListQuery, InstantUploadRequest},
    models::upload_session::{CompleteChunkedUploadRequest, InitChunkedUploadRequest},
    repositories::{
        DynFileVersionsRepo, DynFilesRepo, DynUsersRepo, SqlxFileVersionsRepo, SqlxFilesRepo,
        SqlxUsersRepo,
    },
    services::file::{FileService, FileServiceError},
    services::storage::{LocalStorage, StorageBackend},
};

// ============================================================================
// 测试辅助函数：创建测试 FileService
// ============================================================================

async fn create_test_service(pool: sqlx::PgPool) -> FileService {
    let config = Arc::new(Config::from_env().unwrap());
    let storage: Arc<dyn StorageBackend> = Arc::new(LocalStorage::new(config.storage.path.clone()));

    let files_repo: DynFilesRepo =
        Arc::new(SqlxFilesRepo::new_with_replica(pool.clone(), pool.clone()));
    let users_repo: DynUsersRepo = Arc::new(SqlxUsersRepo::new(pool.clone()));
    let file_versions_repo: DynFileVersionsRepo = Arc::new(SqlxFileVersionsRepo::new(pool.clone()));

    FileService::new(
        files_repo,
        file_versions_repo,
        users_repo,
        pool,
        storage,
        config,
        None,
    )
}

// ============================================================================
// 文件重命名测试
// ============================================================================

#[tokio::test]
async fn test_file_service_rename_happy_path() {
    init_test_env();
    let pool = create_test_pool().await;
    cleanup_test_data(&pool).await;

    let (user_id, _, _) = create_test_user(&pool, "rename_happy").await;
    let file_id = create_test_file(&pool, user_id, "old_name.txt").await;
    let service = create_test_service(pool.clone()).await;

    let result = service
        .rename_file(
            user_id,
            file_id,
            file_storage_backend::models::file::RenameFileRequest {
                name: "new_name.txt".to_string(),
            },
        )
        .await;

    assert!(result.is_ok());
    let updated = result.unwrap();
    assert_eq!(updated.original_filename, "new_name.txt");
}

#[tokio::test]
async fn test_file_service_rename_empty_name() {
    init_test_env();
    let pool = create_test_pool().await;
    cleanup_test_data(&pool).await;

    let (user_id, _, _) = create_test_user(&pool, "rename_empty").await;
    let file_id = create_test_file(&pool, user_id, "test.txt").await;
    let service = create_test_service(pool.clone()).await;

    let result = service
        .rename_file(
            user_id,
            file_id,
            file_storage_backend::models::file::RenameFileRequest {
                name: "   ".to_string(),
            },
        )
        .await;

    assert!(result.is_err());
    let err = result.err().unwrap();
    assert!(format!("{err}").contains("文件名不能为空"));
}

#[tokio::test]
async fn test_file_service_rename_too_long() {
    init_test_env();
    let pool = create_test_pool().await;
    cleanup_test_data(&pool).await;

    let (user_id, _, _) = create_test_user(&pool, "rename_long").await;
    let file_id = create_test_file(&pool, user_id, "test.txt").await;
    let service = create_test_service(pool.clone()).await;

    let long_name = "a".repeat(300);
    let result = service
        .rename_file(
            user_id,
            file_id,
            file_storage_backend::models::file::RenameFileRequest { name: long_name },
        )
        .await;

    assert!(result.is_err());
    let err = result.err().unwrap();
    assert!(format!("{err}").contains("文件名过长"));
}

#[tokio::test]
async fn test_file_service_rename_invalid_chars() {
    init_test_env();
    let pool = create_test_pool().await;
    cleanup_test_data(&pool).await;

    let (user_id, _, _) = create_test_user(&pool, "rename_invalid").await;
    let file_id = create_test_file(&pool, user_id, "test.txt").await;
    let service = create_test_service(pool.clone()).await;

    let result = service
        .rename_file(
            user_id,
            file_id,
            file_storage_backend::models::file::RenameFileRequest {
                name: "bad/name.txt".to_string(),
            },
        )
        .await;

    assert!(result.is_err());
    let err = result.err().unwrap();
    assert!(format!("{err}").contains("文件名包含非法字符"));
}

#[tokio::test]
async fn test_file_service_rename_same_name() {
    init_test_env();
    let pool = create_test_pool().await;
    cleanup_test_data(&pool).await;

    let (user_id, _, _) = create_test_user(&pool, "rename_same").await;
    let file_id = create_test_file(&pool, user_id, "same_name.txt").await;
    let service = create_test_service(pool.clone()).await;

    let result = service
        .rename_file(
            user_id,
            file_id,
            file_storage_backend::models::file::RenameFileRequest {
                name: "same_name.txt".to_string(),
            },
        )
        .await;

    assert!(result.is_ok());
}

#[tokio::test]
async fn test_file_service_rename_file_not_found() {
    init_test_env();
    let pool = create_test_pool().await;
    cleanup_test_data(&pool).await;

    let (user_id, _, _) = create_test_user(&pool, "rename_notfound").await;
    let fake_file_id = uuid::Uuid::new_v4();
    let service = create_test_service(pool.clone()).await;

    let result = service
        .rename_file(
            user_id,
            fake_file_id,
            file_storage_backend::models::file::RenameFileRequest {
                name: "new.txt".to_string(),
            },
        )
        .await;

    assert!(result.is_err());
}

#[tokio::test]
async fn test_file_service_rename_duplicate_name() {
    init_test_env();
    let pool = create_test_pool().await;
    cleanup_test_data(&pool).await;

    let (user_id, _, _) = create_test_user(&pool, "rename_dupe").await;
    let _file1_id = create_test_file(&pool, user_id, "existing.txt").await;
    let file2_id = create_test_file(&pool, user_id, "file2.txt").await;
    let service = create_test_service(pool.clone()).await;

    // 尝试把 file2 重命名为 existing.txt（已存在）
    let result = service
        .rename_file(
            user_id,
            file2_id,
            file_storage_backend::models::file::RenameFileRequest {
                name: "existing.txt".to_string(),
            },
        )
        .await;

    assert!(result.is_err());
    let err = result.err().unwrap();
    assert!(format!("{err}").contains("同名文件已存在"));
}

// ============================================================================
// 文件列表查询测试
// ============================================================================

#[tokio::test]
async fn test_file_service_list_basic() {
    init_test_env();
    let pool = create_test_pool().await;
    cleanup_test_data(&pool).await;

    let (user_id, _, _) = create_test_user(&pool, "list_basic").await;
    create_test_file(&pool, user_id, "file1.txt").await;
    create_test_file(&pool, user_id, "file2.txt").await;
    create_test_file(&pool, user_id, "file3.txt").await;

    let service = create_test_service(pool.clone()).await;
    let result = service.list_files(user_id, FileListQuery::default()).await;

    assert!(result.is_ok());
    let (files, total, _) = result.unwrap();
    assert_eq!(files.len(), 3);
    assert_eq!(total, Some(3));
}

#[tokio::test]
async fn test_file_service_list_empty() {
    init_test_env();
    let pool = create_test_pool().await;
    cleanup_test_data(&pool).await;

    let (user_id, _, _) = create_test_user(&pool, "list_empty").await;
    let service = create_test_service(pool.clone()).await;
    let result = service.list_files(user_id, FileListQuery::default()).await;

    assert!(result.is_ok());
    let (files, total, _) = result.unwrap();
    assert_eq!(files.len(), 0);
    assert_eq!(total, Some(0));
}

#[tokio::test]
async fn test_file_service_list_pagination() {
    init_test_env();
    let pool = create_test_pool().await;
    cleanup_test_data(&pool).await;

    let (user_id, _, _) = create_test_user(&pool, "list_page").await;
    for i in 1..=5 {
        create_test_file(&pool, user_id, &format!("file{}.txt", i)).await;
    }

    let service = create_test_service(pool.clone()).await;

    // 第一页
    let query1 = FileListQuery {
        page: Some(1),
        limit: Some(2),
        ..Default::default()
    };
    let result1 = service.list_files(user_id, query1).await;
    assert!(result1.is_ok());
    let (files1, total1, _) = result1.unwrap();
    assert_eq!(files1.len(), 2);
    assert_eq!(total1, Some(5));

    // 第二页
    let query2 = FileListQuery {
        page: Some(2),
        limit: Some(2),
        ..Default::default()
    };
    let result2 = service.list_files(user_id, query2).await;
    assert!(result2.is_ok());
    let (files2, _, _) = result2.unwrap();
    assert_eq!(files2.len(), 2);
}

// ============================================================================
// 存储用量测试
// ============================================================================

#[tokio::test]
async fn test_file_service_get_storage_usage() {
    init_test_env();
    let pool = create_test_pool().await;
    cleanup_test_data(&pool).await;

    let (user_id, _, _) = create_test_user(&pool, "storage_usage").await;
    create_test_file(&pool, user_id, "file1.txt").await;
    create_test_file(&pool, user_id, "file2.txt").await;

    let service = create_test_service(pool.clone()).await;
    let result = service.get_storage_usage(user_id).await;

    assert!(result.is_ok());
    let (bytes, count) = result.unwrap();
    assert_eq!(count, 2);
    assert_eq!(bytes, 1024 * 2); // 每个测试文件 1KB
}

#[tokio::test]
async fn test_file_service_get_storage_usage_empty() {
    init_test_env();
    let pool = create_test_pool().await;
    cleanup_test_data(&pool).await;

    let (user_id, _, _) = create_test_user(&pool, "storage_empty").await;
    let service = create_test_service(pool.clone()).await;
    let result = service.get_storage_usage(user_id).await;

    assert!(result.is_ok());
    let (bytes, count) = result.unwrap();
    assert_eq!(count, 0);
    assert_eq!(bytes, 0);
}

// ============================================================================
// 分块上传（断点续传）测试
// ============================================================================

#[tokio::test]
async fn test_file_service_chunked_upload_happy_path() {
    init_test_env();
    let pool = create_test_pool().await;
    cleanup_test_data(&pool).await;

    let (user_id, _, _) = create_test_user(&pool, "chunked_happy").await;
    let service = create_test_service(pool.clone()).await;

    let total_size = CHUNK_SIZE as u64 * 2 + 100;
    let init_req = InitChunkedUploadRequest {
        filename: "chunked_test.txt".to_string(),
        mime_type: "text/plain".to_string(),
        total_size,
    };

    // 初始化分块上传
    let (upload_id, chunk_size, total_parts) = service
        .init_chunked_upload(user_id, init_req)
        .await
        .unwrap();
    assert_eq!(chunk_size, CHUNK_SIZE);
    assert_eq!(total_parts, 3);

    // 上传第一个分块
    let chunk1_data = Bytes::from(vec![0u8; CHUNK_SIZE as usize]);
    service
        .upload_chunk(upload_id, user_id, 1, chunk1_data, None)
        .await
        .unwrap();

    // 上传第二个分块
    let chunk2_data = Bytes::from(vec![1u8; CHUNK_SIZE as usize]);
    service
        .upload_chunk(upload_id, user_id, 2, chunk2_data, None)
        .await
        .unwrap();

    // 上传第三个分块（最后一个，小于CHUNK_SIZE）
    let chunk3_data = Bytes::from(vec![2u8; 100]);
    service
        .upload_chunk(upload_id, user_id, 3, chunk3_data, None)
        .await
        .unwrap();

    // 查询上传状态
    let (uploaded_parts, parts_total) = service
        .chunked_upload_status(upload_id, user_id)
        .await
        .unwrap();
    assert_eq!(uploaded_parts.len(), 3);
    assert_eq!(parts_total, 3);

    // 完成上传
    let complete_req = CompleteChunkedUploadRequest { folder_id: None };
    let result = service
        .complete_chunked_upload(upload_id, user_id, complete_req)
        .await;
    assert!(result.is_ok());
    let file = result.unwrap();
    assert_eq!(file.filename, "chunked_test.txt");
}

#[tokio::test]
async fn test_file_service_chunked_upload_invalid_part_index() {
    init_test_env();
    let pool = create_test_pool().await;
    cleanup_test_data(&pool).await;

    let (user_id, _, _) = create_test_user(&pool, "chunked_invalid_idx").await;
    let service = create_test_service(pool.clone()).await;

    let init_req = InitChunkedUploadRequest {
        filename: "test.txt".to_string(),
        mime_type: "text/plain".to_string(),
        total_size: CHUNK_SIZE as u64,
    };

    let (upload_id, _, total_parts) = service
        .init_chunked_upload(user_id, init_req)
        .await
        .unwrap();
    assert_eq!(total_parts, 1);

    // 尝试上传不存在的分块
    let chunk_data = Bytes::from(vec![0u8; 100]);
    let result = service
        .upload_chunk(upload_id, user_id, 2, chunk_data, None)
        .await;

    assert!(result.is_err());
    matches!(
        result.err().unwrap(),
        FileServiceError::InvalidChunkIndex { .. }
    );
}

#[tokio::test]
async fn test_file_service_chunked_upload_missing_chunks() {
    init_test_env();
    let pool = create_test_pool().await;
    cleanup_test_data(&pool).await;

    let (user_id, _, _) = create_test_user(&pool, "chunked_missing").await;
    let service = create_test_service(pool.clone()).await;

    let total_size = CHUNK_SIZE as u64 * 2;
    let init_req = InitChunkedUploadRequest {
        filename: "test.txt".to_string(),
        mime_type: "text/plain".to_string(),
        total_size,
    };

    let (upload_id, _, _) = service
        .init_chunked_upload(user_id, init_req)
        .await
        .unwrap();

    // 只上传一个分块
    let chunk_data = Bytes::from(vec![0u8; CHUNK_SIZE as usize]);
    service
        .upload_chunk(upload_id, user_id, 1, chunk_data, None)
        .await
        .unwrap();

    // 尝试完成上传（缺少分块）
    let complete_req = CompleteChunkedUploadRequest { folder_id: None };
    let result = service
        .complete_chunked_upload(upload_id, user_id, complete_req)
        .await;

    assert!(result.is_err());
    matches!(
        result.err().unwrap(),
        FileServiceError::MissingUploadedChunks { .. }
    );
}

#[tokio::test]
async fn test_file_service_chunked_upload_abort() {
    init_test_env();
    let pool = create_test_pool().await;
    cleanup_test_data(&pool).await;

    let (user_id, _, _) = create_test_user(&pool, "chunked_abort").await;
    let service = create_test_service(pool.clone()).await;

    let init_req = InitChunkedUploadRequest {
        filename: "test.txt".to_string(),
        mime_type: "text/plain".to_string(),
        total_size: CHUNK_SIZE as u64,
    };

    let (upload_id, _, _) = service
        .init_chunked_upload(user_id, init_req)
        .await
        .unwrap();

    // 上传分块
    let chunk_data = Bytes::from(vec![0u8; CHUNK_SIZE as usize]);
    service
        .upload_chunk(upload_id, user_id, 1, chunk_data, None)
        .await
        .unwrap();

    // 取消上传
    let result = service.abort_chunked_upload(upload_id, user_id).await;
    assert!(result.is_ok());

    // 验证会话已删除
    let result = service.get_upload_session(upload_id, user_id).await;
    assert!(result.is_err());
    matches!(result.err().unwrap(), FileServiceError::NotFound);
}

#[tokio::test]
async fn test_file_service_chunked_upload_duplicate_chunk() {
    init_test_env();
    let pool = create_test_pool().await;
    cleanup_test_data(&pool).await;

    let (user_id, _, _) = create_test_user(&pool, "chunked_dup").await;
    let service = create_test_service(pool.clone()).await;

    let init_req = InitChunkedUploadRequest {
        filename: "test.txt".to_string(),
        mime_type: "text/plain".to_string(),
        total_size: CHUNK_SIZE as u64,
    };

    let (upload_id, _, _) = service
        .init_chunked_upload(user_id, init_req)
        .await
        .unwrap();

    // 上传同一个分块两次
    let chunk_data = Bytes::from(vec![0u8; CHUNK_SIZE as usize]);
    service
        .upload_chunk(upload_id, user_id, 1, chunk_data.clone(), None)
        .await
        .unwrap();
    let result = service
        .upload_chunk(upload_id, user_id, 1, chunk_data, None)
        .await;

    // 应该成功（幂等）
    assert!(result.is_ok());
}

// ============================================================================
// 秒传测试
// ============================================================================

#[tokio::test]
async fn test_file_service_instant_upload_happy_path() {
    init_test_env();
    let pool = create_test_pool().await;
    cleanup_test_data(&pool).await;

    let (user_id, _, _) = create_test_user(&pool, "instant_happy").await;
    let service = create_test_service(pool.clone()).await;

    // 先创建一个文件
    let _file_id = create_test_file(&pool, user_id, "original.txt").await;

    // 获取文件内容哈希（模拟客户端计算）
    let content_sha256 = "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";

    let req = InstantUploadRequest {
        filename: "duplicate.txt".to_string(),
        mime_type: "text/plain".to_string(),
        file_size: 1024,
        content_sha256: content_sha256.to_string(),
        folder_id: None,
    };

    // 秒传应该返回 None（因为没有匹配的文件）
    let result = service.instant_upload(user_id, req).await;
    assert!(result.is_ok());
    assert!(result.unwrap().is_none());
}

#[tokio::test]
async fn test_file_service_instant_upload_invalid_hash() {
    init_test_env();
    let pool = create_test_pool().await;
    cleanup_test_data(&pool).await;

    let (user_id, _, _) = create_test_user(&pool, "instant_invalid").await;
    let service = create_test_service(pool.clone()).await;

    let req = InstantUploadRequest {
        filename: "test.txt".to_string(),
        mime_type: "text/plain".to_string(),
        file_size: 1024,
        content_sha256: "invalid-hash".to_string(), // 不是64位十六进制
        folder_id: None,
    };

    let result = service.instant_upload(user_id, req).await;
    assert!(result.is_err());
}

#[tokio::test]
async fn test_file_service_instant_upload_empty_hash() {
    init_test_env();
    let pool = create_test_pool().await;
    cleanup_test_data(&pool).await;

    let (user_id, _, _) = create_test_user(&pool, "instant_empty").await;
    let service = create_test_service(pool.clone()).await;

    let req = InstantUploadRequest {
        filename: "test.txt".to_string(),
        mime_type: "text/plain".to_string(),
        file_size: 1024,
        content_sha256: "".to_string(),
        folder_id: None,
    };

    let result = service.instant_upload(user_id, req).await;
    assert!(result.is_err());
}

// ============================================================================
// 存储配额测试
// ============================================================================

#[tokio::test]
async fn test_file_service_quota_exceeded() {
    init_test_env();
    let pool = create_test_pool().await;
    cleanup_test_data(&pool).await;

    let (user_id, _, _) = create_test_user(&pool, "quota_test").await;
    let service = create_test_service(pool.clone()).await;

    // 设置用户配额为 1KB
    sqlx::query("UPDATE users SET storage_quota = $1 WHERE id = $2")
        .bind(1024i64)
        .bind(user_id)
        .execute(&pool)
        .await
        .unwrap();

    // 创建一个 1KB 的文件（占用全部配额）
    create_test_file(&pool, user_id, "small.txt").await;

    // 尝试创建另一个文件（应该超出配额）
    let result = service
        .ensure_can_store_detailed(user_id, "text/plain", 1024)
        .await;
    assert!(result.is_err());
    let err = result.err().unwrap();
    assert!(format!("{err}").contains("存储配额不足"));
}

#[tokio::test]
async fn test_file_service_get_quota() {
    init_test_env();
    let pool = create_test_pool().await;
    cleanup_test_data(&pool).await;

    let (user_id, _, _) = create_test_user(&pool, "quota_get").await;
    let service = create_test_service(pool.clone()).await;

    // 默认应该没有配额限制（None）
    let result = service.get_storage_quota(user_id).await;
    assert!(result.is_ok());
    assert!(result.unwrap().is_none());

    // 设置配额
    sqlx::query("UPDATE users SET storage_quota = $1 WHERE id = $2")
        .bind(1024 * 1024i64) // 1MB
        .bind(user_id)
        .execute(&pool)
        .await
        .unwrap();

    // 验证配额已设置
    let result = service.get_storage_quota(user_id).await;
    assert!(result.is_ok());
    assert_eq!(result.unwrap(), Some(1024 * 1024));
}

// ============================================================================
// 文件删除测试
// ============================================================================

#[tokio::test]
async fn test_file_service_delete_file_happy_path() {
    init_test_env();
    let pool = create_test_pool().await;
    cleanup_test_data(&pool).await;

    let (user_id, _, _) = create_test_user(&pool, "delete_happy").await;
    let file_id = create_test_file(&pool, user_id, "to_delete.txt").await;
    let service = create_test_service(pool.clone()).await;

    let result = service.delete_file(file_id, user_id).await;
    assert!(result.is_ok());

    // 验证文件已删除（通过公共API）
    let result = service.get_file(file_id, user_id).await;
    assert!(result.is_err());
    matches!(
        result.err().unwrap(),
        file_storage_backend::utils::AppError::NotFound
    );
}

#[tokio::test]
async fn test_file_service_delete_nonexistent_file() {
    init_test_env();
    let pool = create_test_pool().await;
    cleanup_test_data(&pool).await;

    let (user_id, _, _) = create_test_user(&pool, "delete_nonexistent").await;
    let fake_file_id = uuid::Uuid::new_v4();
    let service = create_test_service(pool.clone()).await;

    let result = service.delete_file(fake_file_id, user_id).await;
    assert!(result.is_err());
    matches!(
        result.err().unwrap(),
        file_storage_backend::utils::AppError::NotFound
    );
}

#[tokio::test]
async fn test_file_service_batch_delete() {
    init_test_env();
    let pool = create_test_pool().await;
    cleanup_test_data(&pool).await;

    let (user_id, _, _) = create_test_user(&pool, "batch_delete").await;
    let file1_id = create_test_file(&pool, user_id, "file1.txt").await;
    let file2_id = create_test_file(&pool, user_id, "file2.txt").await;
    let file3_id = create_test_file(&pool, user_id, "file3.txt").await;

    let service = create_test_service(pool.clone()).await;

    // 批量删除前两个文件
    let result = service.batch_delete(&[file1_id, file2_id], user_id).await;
    assert!(result.is_ok());
    assert_eq!(result.unwrap(), 2);

    // 验证文件已删除（通过公共API）
    assert!(service.get_file(file1_id, user_id).await.is_err());
    assert!(service.get_file(file2_id, user_id).await.is_err());

    // 第三个文件应该还存在
    assert!(service.get_file(file3_id, user_id).await.is_ok());
}
