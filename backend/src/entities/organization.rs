//! 组织与成员实体
//!
//! 对应数据库表 `organizations` 和 `organization_members`。

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum OrganizationRole {
    Owner,
    Admin,
    Member,
}

impl OrganizationRole {
    pub fn from_str_value(role: &str) -> Option<Self> {
        match role {
            "owner" => Some(Self::Owner),
            "admin" => Some(Self::Admin),
            "member" => Some(Self::Member),
            _ => None,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            OrganizationRole::Owner => "owner",
            OrganizationRole::Admin => "admin",
            OrganizationRole::Member => "member",
        }
    }

    pub fn at_least(&self, other: OrganizationRole) -> bool {
        let self_rank = match self {
            OrganizationRole::Owner => 3,
            OrganizationRole::Admin => 2,
            OrganizationRole::Member => 1,
        };
        let other_rank = match other {
            OrganizationRole::Owner => 3,
            OrganizationRole::Admin => 2,
            OrganizationRole::Member => 1,
        };
        self_rank >= other_rank
    }
}

#[derive(Debug, Clone, FromRow)]
pub struct Organization {
    pub id: Uuid,
    pub name: String,
    pub owner_user_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, FromRow)]
pub struct OrganizationMember {
    pub id: Uuid,
    pub org_id: Uuid,
    pub user_id: Uuid,
    pub role: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
