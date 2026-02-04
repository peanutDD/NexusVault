//! # 分享模型模块
//!
//! 定义文件分享相关的数据模型，包括：
//! - 数据库实体 `FileShare`
//! - 请求/响应 DTO
//!
//! ## 设计原则
//!
//! 1. **关注点分离**: 数据库模型与 API 模型分离
//! 2. **验证集成**: 请求 DTO 可集成 `validator` 进行验证
//! 3. **类型安全**: 使用强类型确保数据完整性

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

// ============================================================================
// 数据库实体
// ============================================================================

/// 文件分享记录
///
/// 对应数据库表 `file_shares`。
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct FileShare {
    /// 分享记录 ID
    pub id: Uuid,
    /// 关联的文件 ID
    pub file_id: Uuid,
    /// 创建者用户 ID
    pub user_id: Uuid,
    /// 分享令牌（用于构建分享 URL）
    pub share_token: String,
    /// 访问密码的 bcrypt 哈希（可选）
    pub password_hash: Option<String>,
    /// 过期时间（可选，None 表示永不过期）
    pub expires_at: Option<DateTime<Utc>>,
    /// 最大下载次数（可选，None 表示无限制）
    pub max_downloads: Option<i32>,
    /// 当前下载次数
    pub download_count: i32,
    /// 创建时间
    pub created_at: DateTime<Utc>,
    /// 更新时间
    pub updated_at: DateTime<Utc>,
}

// ============================================================================
// 请求 DTO
// ============================================================================

/// 创建分享请求
#[derive(Debug, Deserialize)]
pub struct CreateShareRequest {
    /// 要分享的文件 ID
    pub file_id: Uuid,
    /// 访问密码（可选）
    pub password: Option<String>,
    /// 过期天数（可选）
    pub expires_in_days: Option<u32>,
    /// 最大下载次数（可选）
    pub max_downloads: Option<i32>,
}

/// 访问分享请求
///
/// 用于验证分享密码。
#[derive(Debug, Deserialize)]
pub struct AccessShareRequest {
    /// 访问密码
    pub password: Option<String>,
}

/// 批量创建分享请求
#[derive(Debug, Deserialize)]
pub struct BatchShareRequest {
    /// 要分享的文件 ID 列表
    pub file_ids: Vec<Uuid>,
    /// 访问密码（可选，对所有文件相同）
    pub password: Option<String>,
    /// 过期天数（可选）
    pub expires_in_days: Option<u32>,
    /// 最大下载次数（可选）
    pub max_downloads: Option<i32>,
}

// ============================================================================
// 响应 DTO
// ============================================================================

/// 分享响应
///
/// 返回给客户端的分享信息。
#[derive(Debug, Serialize)]
pub struct ShareResponse {
    /// 分享记录 ID
    pub share_id: Uuid,
    /// 分享 URL（相对路径，如 `/share/abc123`）
    pub share_url: String,
    /// 分享令牌
    pub share_token: String,
    /// 过期时间
    pub expires_at: Option<DateTime<Utc>>,
    /// 最大下载次数
    pub max_downloads: Option<i32>,
}

/// 批量分享响应
#[derive(Debug, Serialize)]
pub struct BatchShareResponse {
    /// 成功创建的分享列表
    pub shares: Vec<ShareResponse>,
    /// 分享失败的文件 ID 列表
    pub failed: Vec<Uuid>,
}

impl FileShare {
    /// 检查分享是否已过期
    #[allow(dead_code)]
    pub fn is_expired(&self) -> bool {
        self.expires_at
            .map(|exp| Utc::now() > exp)
            .unwrap_or(false)
    }

    /// 检查是否已达到下载次数限制
    #[allow(dead_code)]
    pub fn is_download_limit_reached(&self) -> bool {
        self.max_downloads
            .map(|max| self.download_count >= max)
            .unwrap_or(false)
    }

    /// 检查是否需要密码
    #[allow(dead_code)]
    pub fn requires_password(&self) -> bool {
        self.password_hash.is_some()
    }
}
