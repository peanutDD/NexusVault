//! 组织相关 DTO

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use crate::entities::organization::OrganizationRole;

#[derive(Debug, Deserialize)]
pub struct CreateOrganizationRequest {
    pub name: String,
}

#[derive(Debug, Serialize)]
pub struct OrganizationResponse {
    pub id: Uuid,
    pub name: String,
    pub role: OrganizationRole,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct OrganizationMemberResponse {
    pub id: Uuid,
    pub user_id: Uuid,
    pub role: OrganizationRole,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct AddMemberRequest {
    pub email: String,
    pub role: String,
}