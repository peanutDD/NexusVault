use std::io;

use thiserror::Error;

use crate::utils::AppError;

#[derive(Debug, Error)]
pub enum FileServiceError {
    #[error(transparent)]
    App(#[from] AppError),

    #[error("resource not found")]
    NotFound,

    #[error("validation failed: {0}")]
    Validation(String),

    #[error("too many concurrent chunked uploads")]
    TooManyConcurrentUploads { limit: i64 },

    #[error("upload session expired")]
    UploadSessionExpired,

    #[error("invalid chunk index")]
    InvalidChunkIndex { part_index: u32 },

    #[error("invalid part sha256 header")]
    InvalidPartSha256Header,

    #[error("chunk checksum mismatch")]
    ChunkChecksumMismatch { part_index: u32 },

    #[error("insufficient disk space for chunk write")]
    InsufficientDiskSpaceForChunk,

    #[error("insufficient disk space for chunk merge")]
    InsufficientDiskSpaceForMerge,

    #[error("missing uploaded chunks")]
    MissingUploadedChunks { uploaded: usize, total: u32 },

    #[error("merged file size mismatch")]
    MergedFileSizeMismatch,

    #[error("failed to create chunk temp dir")]
    CreateChunkTempDir { source: io::Error },

    #[error("failed to write chunk")]
    WriteChunk { source: io::Error },

    #[error("failed to create merged file")]
    CreateMergedFile { source: io::Error },

    #[error("failed to read chunk")]
    ReadChunk { part_index: u32, source: io::Error },

    #[error("failed to merge chunks")]
    MergeChunks { source: io::Error },

    #[error("failed to flush merged file")]
    FlushMergedFile { source: io::Error },

    #[error("failed to stat merged file")]
    StatMergedFile { source: io::Error },

    #[error("background hash task failed")]
    BackgroundHashTask,
}

impl From<FileServiceError> for AppError {
    fn from(err: FileServiceError) -> Self {
        match err {
            FileServiceError::App(app_error) => app_error,
            FileServiceError::NotFound => AppError::NotFound,
            FileServiceError::Validation(message) => AppError::Validation(message),
            FileServiceError::TooManyConcurrentUploads { limit } => AppError::Validation(format!(
                "同时进行的分片上传不能超过 {} 个，请先完成或取消其他大文件上传",
                limit
            )),
            FileServiceError::UploadSessionExpired => {
                AppError::Validation("上传会话已过期".to_string())
            }
            FileServiceError::InvalidChunkIndex { part_index } => {
                AppError::Validation(format!("无效的分块索引: {}", part_index))
            }
            FileServiceError::InvalidPartSha256Header => {
                AppError::Validation("X-Part-SHA256 须为 64 位十六进制".to_string())
            }
            FileServiceError::ChunkChecksumMismatch { part_index } => {
                AppError::Validation(format!("分块 {} 校验失败: SHA-256 不匹配", part_index))
            }
            FileServiceError::InsufficientDiskSpaceForChunk => {
                AppError::Storage("磁盘空间不足，请稍后重试".to_string())
            }
            FileServiceError::InsufficientDiskSpaceForMerge => {
                AppError::Storage("磁盘空间不足，无法完成合并".to_string())
            }
            FileServiceError::MissingUploadedChunks { uploaded, total } => {
                AppError::Validation(format!("缺少分块: 已上传 {}/{}", uploaded, total))
            }
            FileServiceError::MergedFileSizeMismatch => {
                AppError::Validation("文件大小不匹配".to_string())
            }
            FileServiceError::CreateChunkTempDir { source } => {
                AppError::Storage(format!("Failed to create temp dir: {}", source))
            }
            FileServiceError::WriteChunk { source } => {
                AppError::Storage(format!("Failed to write chunk: {}", source))
            }
            FileServiceError::CreateMergedFile { source } => {
                AppError::Storage(format!("Failed to create merged file: {}", source))
            }
            FileServiceError::ReadChunk { part_index, source } => {
                AppError::File(format!("读取分块 {} 失败: {}", part_index, source))
            }
            FileServiceError::MergeChunks { source } => {
                AppError::Storage(format!("Failed to merge chunks: {}", source))
            }
            FileServiceError::FlushMergedFile { source } => {
                AppError::Storage(format!("Failed to flush merged file: {}", source))
            }
            FileServiceError::StatMergedFile { source } => {
                AppError::Storage(format!("Failed to stat merged file: {}", source))
            }
            FileServiceError::BackgroundHashTask => AppError::Internal,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::FileServiceError;
    use crate::utils::AppError;

    #[test]
    fn invalid_sha_header_maps_to_validation_error() {
        let app_error = AppError::from(FileServiceError::InvalidPartSha256Header);

        assert!(matches!(
            app_error,
            AppError::Validation(message) if message == "X-Part-SHA256 须为 64 位十六进制"
        ));
    }

    #[test]
    fn missing_uploaded_chunks_maps_to_validation_error() {
        let app_error = AppError::from(FileServiceError::MissingUploadedChunks {
            uploaded: 2,
            total: 3,
        });

        assert!(matches!(
            app_error,
            AppError::Validation(message) if message == "缺少分块: 已上传 2/3"
        ));
    }

    #[test]
    fn background_hash_task_maps_to_internal_error() {
        let app_error = AppError::from(FileServiceError::BackgroundHashTask);

        assert!(matches!(app_error, AppError::Internal));
    }
}
