//! 文件夹相关 DTO

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize)]
pub struct FolderResponse {
    pub id: Uuid,
    pub name: String,
    pub parent_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateFolderRequest {
    pub name: String,
    pub parent_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct RenameFolderRequest {
    pub name: String,
}

#[derive(Debug, Deserialize)]
pub struct MoveFolderRequest {
    pub parent_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct FolderListQuery {
    pub parent_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct BatchMoveToFolderRequest {
    pub file_ids: Vec<Uuid>,
    pub folder_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct GetFilesInFoldersRequest {
    pub folder_ids: Vec<Uuid>,
}

#[derive(Debug, Serialize)]
pub struct FolderPathResponse {
    pub path: Vec<FolderResponse>,
}

#[derive(Debug, Serialize)]
pub struct FolderContentsResponse {
    pub current: Option<FolderResponse>,
    pub path: Vec<FolderResponse>,
    pub folders: Vec<FolderResponse>,
}
