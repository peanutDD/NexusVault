//! 组织与多租户相关 API
//!
//! 提供基础的组织管理与权限相关接口：
//! - `GET /api/orgs`：列出当前用户所属组织
//! - `POST /api/orgs`：创建组织（当前用户为 Owner）
//! - `GET /api/orgs/:org_id/members`：列出组织成员（成员可见）
//! - `POST /api/orgs/:org_id/members`：按邮箱添加成员，仅 Owner/Admin 可用
//! - `GET /api/orgs/:org_id/files`：列出组织下共享文件
//! - `POST /api/orgs/:org_id/files/:file_id/link`：将个人文件共享到组织
//! - `DELETE /api/orgs/:org_id/files/:file_id/link`：取消文件与组织的关联

use axum::{
    extract::{Path, State},
    routing::{get, post},
    Json, Router,
};
use serde_json::json;
use uuid::Uuid;

use crate::extractors::auth::AuthenticatedUser;
use crate::models::organization::{AddMemberRequest, CreateOrganizationRequest};
use crate::services::organization::OrganizationService;
use crate::utils::AppError;
use crate::AppState;

pub fn create_router() -> Router<AppState> {
    Router::new()
        .route("/orgs", get(list_my_organizations).post(create_organization))
        .route(
            "/orgs/:org_id/members",
            get(list_members).post(add_member_by_email),
        )
        .route("/orgs/:org_id/files", get(list_org_files))
        .route("/orgs/:org_id/files/:file_id/link", post(link_file_to_org))
        .route(
            "/orgs/:org_id/files/:file_id/link",
            axum::routing::delete(unlink_file_from_org),
        )
}

/// 列出当前用户所属的所有组织
async fn list_my_organizations(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
) -> Result<Json<serde_json::Value>, AppError> {
    let service = OrganizationService::from_state(&state);
    let orgs = service.list_my_organizations(user_id).await?;
    Ok(Json(json!({ "organizations": orgs })))
}

/// 创建组织（当前用户为 Owner）
async fn create_organization(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
    Json(req): Json<CreateOrganizationRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let service = OrganizationService::from_state(&state);
    let org = service.create_organization(user_id, req).await?;
    Ok(Json(json!({ "organization": org })))
}

/// 列出组织成员
async fn list_members(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
    Path(org_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    let service = OrganizationService::from_state(&state);
    let members = service.list_members(user_id, org_id).await?;
    Ok(Json(json!({ "members": members })))
}

/// 为组织新增成员（按邮箱），仅 Owner/Admin 可用
async fn add_member_by_email(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
    Path(org_id): Path<Uuid>,
    Json(req): Json<AddMemberRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let service = OrganizationService::from_state(&state);
    let member = service
        .add_member_by_email(user_id, org_id, req)
        .await?;
    Ok(Json(json!({ "member": member })))
}

/// 列出组织下共享的文件
async fn list_org_files(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
    Path(org_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    let service = OrganizationService::from_state(&state);
    let files = service.list_org_files(user_id, org_id).await?;
    Ok(Json(json!({ "files": files })))
}

/// 将当前用户的文件共享到组织
async fn link_file_to_org(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
    Path((org_id, file_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<serde_json::Value>, AppError> {
    let service = OrganizationService::from_state(&state);
    service
        .link_file_to_org(user_id, org_id, file_id)
        .await?;
    Ok(Json(json!({ "ok": true })))
}

/// 取消文件与组织的关联
async fn unlink_file_from_org(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
    Path((org_id, file_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<serde_json::Value>, AppError> {
    let service = OrganizationService::from_state(&state);
    service
        .unlink_file_from_org(user_id, org_id, file_id)
        .await?;
    Ok(Json(json!({ "ok": true })))
}

