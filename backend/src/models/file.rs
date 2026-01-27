//! # 文件模型模块
//!
//! 定义文件相关的数据模型，包括数据库实体和 API DTO。

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

// Re-export share types for backward compatibility
pub use super::share::{
    AccessShareRequest, BatchShareRequest, BatchShareResponse, CreateShareRequest, FileShare,
    ShareResponse,
};

use crate::utils::validate_pagination;

// ============================================================================
// 数据库实体
// ============================================================================

/// 文件记录
///
/// 对应数据库表 `files`。
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct File {
    /// 文件 ID
    pub id: Uuid,
    /// 所属用户 ID
    pub user_id: Uuid,
    /// 存储文件名（UUID 格式）
    pub filename: String,
    /// 原始文件名（用户上传时的文件名）
    pub original_filename: String,
    /// 文件存储路径
    pub file_path: String,
    /// 文件大小（字节）
    pub file_size: i64,
    /// MIME 类型
    pub mime_type: String,
    /// 存储后端类型（local 或 s3）
    pub storage_backend: String,
    /// 文件分类（可选，已弃用，使用 folder_id 代替）
    pub category: Option<String>,
    /// 所属文件夹 ID（NULL 表示根目录）
    pub folder_id: Option<Uuid>,
    /// 创建时间
    pub created_at: DateTime<Utc>,
    /// 更新时间
    pub updated_at: DateTime<Utc>,
}

// ============================================================================
// 响应 DTO
// ============================================================================

/// 文件响应
///
/// 返回给客户端的文件信息（隐藏内部存储路径等敏感信息）。
#[derive(Debug, Serialize)]
pub struct FileResponse {
    pub id: Uuid,
    pub filename: String,
    pub original_filename: String,
    pub file_size: i64,
    pub mime_type: String,
    pub category: Option<String>,
    pub folder_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
}

impl From<File> for FileResponse {
    fn from(file: File) -> Self {
        FileResponse {
            id: file.id,
            filename: file.filename,
            original_filename: file.original_filename,
            file_size: file.file_size,
            mime_type: file.mime_type,
            category: file.category,
            folder_id: file.folder_id,
            created_at: file.created_at,
        }
    }
}

// ============================================================================
// 请求 DTO
// ============================================================================

/// 文件列表查询参数
#[derive(Debug, Deserialize)]
pub struct FileListQuery {
    /// 页码（从 1 开始，默认 1）
    pub page: Option<u32>,
    /// 每页数量（默认 20，最大 100）
    pub limit: Option<u32>,
    /// 搜索关键词（匹配文件名）
    pub search: Option<String>,
    /// MIME 类型过滤
    pub mime_type: Option<String>,
    /// 分类过滤（已弃用，使用 folder_id 代替）
    pub category: Option<String>,
    /// 文件夹 ID 过滤（传 "null" 或不传表示根目录）
    pub folder_id: Option<String>,
    /// 日期范围起始（ISO 8601 格式）
    pub date_from: Option<String>,
    /// 日期范围结束（ISO 8601 格式）
    pub date_to: Option<String>,
    /// 文件大小最小值（字节）
    pub size_min: Option<i64>,
    /// 文件大小最大值（字节）
    pub size_max: Option<i64>,
}

impl FileListQuery {
    /// 验证并获取规范化的分页参数
    ///
    /// # 返回
    /// - `Ok((page, limit))`: 验证通过的分页参数
    /// - `Err(AppError)`: 参数无效
    pub fn validate_pagination(&self) -> Result<(u32, u32), crate::utils::AppError> {
        validate_pagination(self.page, self.limit)
    }

    /// 获取规范化的页码（至少为 1）
    pub fn page_normalized(&self) -> u32 {
        self.page.unwrap_or(1).max(1)
    }

    /// 获取规范化的每页数量（1-100 之间）
    pub fn limit_normalized(&self) -> u32 {
        self.limit.unwrap_or(20).clamp(1, 100)
    }
}

/// 批量删除请求
#[derive(Debug, Deserialize)]
pub struct BatchDeleteRequest {
    /// 要删除的文件 ID 列表
    pub ids: Vec<Uuid>,
}

/// 批量移动请求
#[derive(Debug, Deserialize)]
pub struct BatchMoveRequest {
    /// 要移动的文件 ID 列表
    pub ids: Vec<Uuid>,
    /// 目标分类（空字符串或 null 表示取消分类）
    pub category: Option<String>,
}
