//! 组织与多租户模型
//!
//! 提供 Organization（团队）、Membership（成员与角色）等数据结构，
//! 作为多租户与权限体系的基础。

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// 组织角色
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum OrganizationRole {
    Owner,
    Admin,
    Member,
}

impl OrganizationRole {
    /// 从字符串解析角色（用于从数据库或请求中读取）
    pub fn from_str(role: &str) -> Option<Self> {
        match role {
            "owner" => Some(Self::Owner),
            "admin" => Some(Self::Admin),
            "member" => Some(Self::Member),
            _ => None,
        }
    }

    /// 返回数据库中使用的字符串表示
    pub fn as_str(&self) -> &'static str {
        match self {
            OrganizationRole::Owner => "owner",
            OrganizationRole::Admin => "admin",
            OrganizationRole::Member => "member",
        }
    }

    /// 是否至少具备指定角色（owner >= admin >= member）
    pub fn at_least(&self, other: OrganizationRole) -> bool {
        use OrganizationRole::*;
        let self_rank = match self {
            Owner => 3,
            Admin => 2,
            Member => 1,
        };
        let other_rank = match other {
            Owner => 3,
            Admin => 2,
            Member => 1,
        };
        self_rank >= other_rank
    }
}

/// 组织实体，对应 `organizations` 表
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Organization {
    pub id: Uuid,
    pub name: String,
    pub owner_user_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// 组织成员实体，对应 `organization_members` 表
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct OrganizationMember {
    pub id: Uuid,
    pub org_id: Uuid,
    pub user_id: Uuid,
    pub role: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// 创建组织请求
#[derive(Debug, Deserialize)]
pub struct CreateOrganizationRequest {
    pub name: String,
}

/// 组织响应（包含当前用户在该组织中的角色）
#[derive(Debug, Serialize)]
pub struct OrganizationResponse {
    pub id: Uuid,
    pub name: String,
    pub role: OrganizationRole,
    pub created_at: DateTime<Utc>,
}

/// 组织成员响应
#[derive(Debug, Serialize)]
pub struct OrganizationMemberResponse {
    pub id: Uuid,
    pub user_id: Uuid,
    pub role: OrganizationRole,
    pub created_at: DateTime<Utc>,
}

/// 新增成员请求
#[derive(Debug, Deserialize)]
pub struct AddMemberRequest {
    /// 成员邮箱（通过邮箱查找用户）
    pub email: String,
    /// 角色：owner / admin / member
    pub role: String,
}

