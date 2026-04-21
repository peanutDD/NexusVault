//! 兼容转发层
//!
//! - DB 实体 → [`crate::entities::folder`] ✅ 已迁移
//! - API DTO → [`crate::types::folder`] ✅ 已迁移

pub use crate::entities::folder::Folder;

pub use crate::types::folder::{
    BatchMoveToFolderRequest, CreateFolderRequest, FolderContentsResponse, FolderListQuery,
    FolderPathResponse, FolderResponse, GetFilesInFoldersRequest, MoveFolderRequest,
    RenameFolderRequest,
};

impl From<crate::entities::folder::Folder> for FolderResponse {
    fn from(folder: crate::entities::folder::Folder) -> Self {
        FolderResponse {
            id: folder.id,
            name: folder.name,
            parent_id: folder.parent_id,
            created_at: folder.created_at,
            updated_at: folder.updated_at,
        }
    }
}
