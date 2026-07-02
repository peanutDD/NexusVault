//! 兼容转发层：将 entity 和 type 重新导出，兼容现有 import
//!
//! ## 迁移状态
//!
//! - DB 实体 → [`crate::entities::file`] ✅ 已迁移
//! - API DTO → [`crate::types::file`] ✅ 已迁移

pub use crate::entities::file::{File, FileVersion};

pub use crate::types::file::{
    BatchDeleteRequest, BatchGetRequest, BatchMoveRequest, BatchTrashFailure, BatchTrashResult,
    FileCollectionCountsResponse, FileListQuery, FileListResult, FileResponse, FileVersionResponse,
    InstantUploadRequest, RenameFileRequest, RestoreVersionRequest, UpdateFileFlagsRequest,
    UpdateVersionLabelRequest,
};

impl From<crate::entities::file::File> for FileResponse {
    fn from(file: crate::entities::file::File) -> Self {
        FileResponse {
            id: file.id,
            filename: file.filename,
            original_filename: file.original_filename,
            file_size: file.file_size,
            mime_type: file.mime_type,
            category: file.category,
            folder_id: file.folder_id,
            tags: Vec::new(),
            is_favorite: file.is_favorite,
            is_pinned: file.is_pinned,
            last_opened_at: file.last_opened_at,
            created_at: file.created_at,
            deleted_at: file.deleted_at,
        }
    }
}

impl From<crate::entities::file::FileVersion> for FileVersionResponse {
    fn from(version: crate::entities::file::FileVersion) -> Self {
        FileVersionResponse {
            id: version.id,
            file_id: version.file_id,
            version_number: version.version_number,
            filename: version.filename,
            original_filename: version.original_filename,
            file_size: version.file_size,
            mime_type: version.mime_type,
            label: version.label,
            created_at: version.created_at,
        }
    }
}

impl From<crate::entities::file::File> for FileListResult {
    fn from(_file: crate::entities::file::File) -> Self {
        panic!("Use FileListResult {{ files, total, next_cursor }} directly")
    }
}
