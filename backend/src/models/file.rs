//! # 文件模型模块
//!
//! 定义文件相关的数据模型，包括数据库实体和 API DTO。

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

// Re-export share types for backward compatibility
pub use super::share::{AccessShareRequest, BatchShareRequest, CreateShareRequest};

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
    /// 文件内容 SHA-256（十六进制），用于秒传与去重
    pub content_sha256: Option<String>,
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
#[derive(Clone, Debug, Serialize)]
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
    /// 注意：如果提供了 `cursor`，则使用游标分页，忽略 `page` 参数
    pub page: Option<u32>,
    /// 每页数量（默认 20，最大 100）
    pub limit: Option<u32>,
    /// 游标值（用于 keyset/游标分页）
    /// - 如果 `sort_by = created_at`：ISO 8601 时间戳字符串
    /// - 如果 `sort_by = filename`：文件名字符串
    /// - 如果 `sort_by = file_size`：文件大小数字（字符串形式）
    /// 如果提供了 `cursor`，则使用游标分页（WHERE sort_column > cursor），否则使用传统分页（OFFSET）
    pub cursor: Option<String>,
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
    /// 排序字段：created_at（默认）、filename、file_size
    pub sort_by: Option<String>,
    /// 排序方向：desc（默认）、asc
    pub sort_order: Option<String>,
}

/// 文件列表查询结果（支持传统分页和游标分页）
#[derive(Debug)]
pub struct FileListResult {
    /// 文件列表
    pub files: Vec<File>,
    /// 总条数（传统分页时使用，游标分页时为 None）
    pub total: Option<i64>,
    /// 下一个游标值（游标分页时使用，传统分页时为 None）
    /// - 如果 `sort_by = created_at`：ISO 8601 时间戳字符串
    /// - 如果 `sort_by = filename`：文件名字符串
    /// - 如果 `sort_by = file_size`：文件大小数字（字符串形式）
    /// 如果返回 None，表示已到末尾，没有更多数据
    pub next_cursor: Option<String>,
}

/// 秒传请求：客户端已计算文件 SHA-256，若服务器已有相同内容则直接创建记录、不传文件
#[derive(Debug, Deserialize)]
pub struct InstantUploadRequest {
    /// 文件内容 SHA-256（十六进制，64 字符）
    pub content_sha256: String,
    /// 用户可见文件名
    pub filename: String,
    /// 文件大小（字节），用于与 content_sha256 一起匹配已有文件
    pub file_size: u64,
    /// MIME 类型
    pub mime_type: String,
    /// 目标文件夹 ID，不传或 null 表示根目录
    pub folder_id: Option<Uuid>,
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

/// 批量按 ID 查询请求（用于按 ids 批量查详情）
#[derive(Debug, Deserialize)]
pub struct BatchGetRequest {
    /// 要查询的文件 ID 列表
    pub ids: Vec<Uuid>,
}

// ============================================================================
// 文件版本管理
// ============================================================================

/// 文件版本记录
///
/// 对应数据库表 `file_versions`，用于存储文件的历史版本。
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct FileVersion {
    /// 版本记录 ID
    pub id: Uuid,
    /// 关联的文件 ID
    pub file_id: Uuid,
    /// 所属用户 ID
    pub user_id: Uuid,
    /// 版本号（从 1 开始递增）
    pub version_number: i32,
    /// 存储文件名
    pub filename: String,
    /// 原始文件名
    pub original_filename: String,
    /// 文件存储路径
    pub file_path: String,
    /// 文件大小（字节）
    pub file_size: i64,
    /// MIME 类型
    pub mime_type: String,
    /// 存储后端类型
    pub storage_backend: String,
    /// 文件内容 SHA-256
    pub content_sha256: Option<String>,
    /// 版本标签/备注
    pub label: Option<String>,
    /// 创建时间
    pub created_at: DateTime<Utc>,
}

/// 文件版本响应
#[derive(Debug, Serialize)]
pub struct FileVersionResponse {
    pub id: Uuid,
    pub file_id: Uuid,
    pub version_number: i32,
    pub original_filename: String,
    pub file_size: i64,
    pub mime_type: String,
    pub content_sha256: Option<String>,
    pub label: Option<String>,
    pub created_at: DateTime<Utc>,
}

impl From<FileVersion> for FileVersionResponse {
    fn from(version: FileVersion) -> Self {
        FileVersionResponse {
            id: version.id,
            file_id: version.file_id,
            version_number: version.version_number,
            original_filename: version.original_filename,
            file_size: version.file_size,
            mime_type: version.mime_type,
            content_sha256: version.content_sha256,
            label: version.label,
            created_at: version.created_at,
        }
    }
}

/// 更新版本标签请求
#[derive(Debug, Deserialize)]
pub struct UpdateVersionLabelRequest {
    /// 版本标签/备注
    pub label: Option<String>,
}

/// 恢复版本请求
#[derive(Debug, Deserialize)]
pub struct RestoreVersionRequest {
    /// 是否保留当前版本为历史版本（默认 true）
    #[serde(default = "default_true")]
    pub keep_current: bool,
}

fn default_true() -> bool {
    true
}
