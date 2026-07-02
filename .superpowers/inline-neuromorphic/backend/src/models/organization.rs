//! 兼容转发层
//!
//! - DB 实体 → [`crate::entities::organization`] ✅ 已迁移
//! - API DTO → [`crate::types::organization`] ✅ 已迁移

pub use crate::entities::organization::{Organization, OrganizationMember, OrganizationRole};

pub use crate::types::organization::{
    AddMemberRequest, CreateOrganizationRequest, OrganizationMemberResponse, OrganizationResponse,
};

impl From<crate::entities::organization::Organization> for OrganizationResponse {
    fn from(org: crate::entities::organization::Organization) -> Self {
        OrganizationResponse {
            id: org.id,
            name: org.name,
            role: OrganizationRole::Owner,
            created_at: org.created_at,
        }
    }
}
