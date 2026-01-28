//! # 文件夹模型模块
//!
//! 定义文件夹相关的数据模型，包括数据库实体和 API DTO。

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

// ============================================================================
// 数据库实体
// ============================================================================

/// 文件夹记录
///
/// 对应数据库表 `folders`，支持多层嵌套结构。
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Folder {
    /// 文件夹 ID
    pub id: Uuid,
    /// 所属用户 ID
    pub user_id: Uuid,
    /// 文件夹名称
    pub name: String,
    /// 父文件夹 ID（NULL 表示根目录）
    pub parent_id: Option<Uuid>,
    /// 创建时间
    pub created_at: DateTime<Utc>,
    /// 更新时间
    pub updated_at: DateTime<Utc>,
}

// ============================================================================
// 响应 DTO
// ============================================================================

/// 文件夹响应
///
/// 返回给客户端的文件夹信息。
#[derive(Debug, Serialize)]
pub struct FolderResponse {
    pub id: Uuid,
    pub name: String,
    pub parent_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<Folder> for FolderResponse {
    fn from(folder: Folder) -> Self {
        FolderResponse {
            id: folder.id,
            name: folder.name,
            parent_id: folder.parent_id,
            created_at: folder.created_at,
            updated_at: folder.updated_at,
        }
    }
}

/// 文件夹路径响应（面包屑导航）
///
/// 返回从根目录到当前文件夹的路径。
#[derive(Debug, Serialize)]
pub struct FolderPathResponse {
    /// 路径列表（从根目录到当前文件夹）
    pub path: Vec<FolderResponse>,
}

/// 文件夹内容响应
///
/// 返回文件夹中的子文件夹和文件。
#[derive(Debug, Serialize)]
pub struct FolderContentsResponse {
    /// 当前文件夹信息（根目录时为 None）
    pub current: Option<FolderResponse>,
    /// 路径（面包屑）
    pub path: Vec<FolderResponse>,
    /// 子文件夹列表
    pub folders: Vec<FolderResponse>,
}

// ============================================================================
// 请求 DTO
// ============================================================================

/// 创建文件夹请求
#[derive(Debug, Deserialize)]
pub struct CreateFolderRequest {
    /// 文件夹名称
    pub name: String,
    /// 父文件夹 ID（不传或 null 表示根目录）
    pub parent_id: Option<Uuid>,
}

/// 重命名文件夹请求
#[derive(Debug, Deserialize)]
pub struct RenameFolderRequest {
    /// 新名称
    pub name: String,
}

/// 移动文件夹请求
#[derive(Debug, Deserialize)]
pub struct MoveFolderRequest {
    /// 新的父文件夹 ID（null 表示移动到根目录）
    pub parent_id: Option<Uuid>,
}

/// 文件夹列表查询参数
#[derive(Debug, Deserialize)]
pub struct FolderListQuery {
    /// 父文件夹 ID（不传表示查询根目录下的文件夹）
    pub parent_id: Option<Uuid>,
}

/// 批量移动文件到文件夹请求
#[derive(Debug, Deserialize)]
pub struct BatchMoveToFolderRequest {
    /// 要移动的文件 ID 列表
    pub file_ids: Vec<Uuid>,
    /// 目标文件夹 ID（null 表示移动到根目录）
    pub folder_id: Option<Uuid>,
}

/// 获取文件夹内所有文件请求
#[derive(Debug, Deserialize)]
pub struct GetFilesInFoldersRequest {
    /// 文件夹 ID 列表
    pub folder_ids: Vec<Uuid>,
}
