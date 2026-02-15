//! 组织与多租户服务
//!
//! 封装 Organization / Membership / 组织文件共享 的业务逻辑：
//! - 创建组织（Owner）
//! - 列出当前用户所属组织
//! - 为组织添加成员（按邮箱查找用户）
//! - 为组织关联/取消关联文件
//! - 按权限列出组织成员与文件

use std::sync::Arc;

use sqlx::PgPool;
use uuid::Uuid;

use crate::config::Config;
use crate::models::file::FileResponse;
use crate::models::organization::{
    AddMemberRequest, CreateOrganizationRequest, OrganizationMemberResponse, OrganizationResponse,
    OrganizationRole,
};
use crate::models::user::User;
use crate::repositories::{OrganizationsRepo, SqlxFilesRepo, SqlxUsersRepo};
use crate::utils::AppError;

pub struct OrganizationService {
    pool: PgPool,
    _config: Arc<Config>,
}

impl OrganizationService {
    pub fn new(pool: PgPool, config: Arc<Config>) -> Self {
        Self {
            pool,
            _config: config,
        }
    }

    pub fn from_state(state: &crate::AppState) -> Self {
        Self::new(state.pool.clone(), state.config.clone())
    }

    fn org_repo(&self) -> OrganizationsRepo {
        OrganizationsRepo::new(self.pool.clone())
    }

    fn users_repo(&self) -> SqlxUsersRepo {
        SqlxUsersRepo::new(self.pool.clone())
    }

    /// 创建组织，并将当前用户设为 Owner。
    pub async fn create_organization(
        &self,
        owner_user_id: Uuid,
        req: CreateOrganizationRequest,
    ) -> Result<OrganizationResponse, AppError> {
        let name = req.name.trim();
        if name.is_empty() {
            return Err(AppError::Validation("组织名称不能为空".to_string()));
        }
        if name.len() > 255 {
            return Err(AppError::Validation("组织名称过长".to_string()));
        }

        let repo = self.org_repo();
        let org = repo.create_organization(name, owner_user_id).await?;

        Ok(OrganizationResponse {
            id: org.id,
            name: org.name,
            role: OrganizationRole::Owner,
            created_at: org.created_at,
        })
    }

    /// 列出当前用户所属的所有组织及其角色。
    pub async fn list_my_organizations(
        &self,
        user_id: Uuid,
    ) -> Result<Vec<OrganizationResponse>, AppError> {
        let repo = self.org_repo();
        let rows = repo.list_organizations_for_user(user_id).await?;

        Ok(rows
            .into_iter()
            .map(|(org, role)| OrganizationResponse {
                id: org.id,
                name: org.name,
                role,
                created_at: org.created_at,
            })
            .collect())
    }

    /// 校验当前用户在组织中的角色是否至少为指定级别。
    async fn ensure_role_at_least(
        &self,
        org_id: Uuid,
        user_id: Uuid,
        required: OrganizationRole,
    ) -> Result<OrganizationRole, AppError> {
        let repo = self.org_repo();
        let membership = repo.get_membership(org_id, user_id).await?;

        let Some((_m, role)) = membership else {
            return Err(AppError::Unauthorized);
        };

        if !role.at_least(required) {
            return Err(AppError::Unauthorized);
        }

        Ok(role)
    }

    /// 为组织添加成员（按邮箱查找用户），仅 Owner/Admin 可调用。
    pub async fn add_member_by_email(
        &self,
        actor_user_id: Uuid,
        org_id: Uuid,
        req: AddMemberRequest,
    ) -> Result<OrganizationMemberResponse, AppError> {
        // 校验角色参数
        let role = OrganizationRole::from_str(req.role.as_str()).ok_or_else(|| {
            AppError::Validation("角色必须是 owner/admin/member 之一".to_string())
        })?;

        // 权限：只有 Owner / Admin 可以新增成员
        self.ensure_role_at_least(org_id, actor_user_id, OrganizationRole::Admin)
            .await?;

        // 通过邮箱查找用户
        let email = req.email.trim();
        if email.is_empty() {
            return Err(AppError::Validation("邮箱不能为空".to_string()));
        }

        let users_repo = self.users_repo();
        // 通过 trait 方法查找用户（需要 UsersRepository 在作用域中）
        use crate::repositories::traits::UsersRepository;
        let user: Option<User> = users_repo.find_by_email(email).await?;
        let Some(user) = user else {
            return Err(AppError::Validation("指定邮箱的用户不存在".to_string()));
        };

        let repo = self.org_repo();
        repo.upsert_member(org_id, user.id, role).await?;

        Ok(OrganizationMemberResponse {
            id: user.id,
            user_id: user.id,
            role,
            created_at: user.created_at,
        })
    }

    /// 列出组织成员，仅成员可看，通常用于团队管理页面。
    pub async fn list_members(
        &self,
        actor_user_id: Uuid,
        org_id: Uuid,
    ) -> Result<Vec<OrganizationMemberResponse>, AppError> {
        // 任何成员（Member 及以上）都可以查看成员列表
        self.ensure_role_at_least(org_id, actor_user_id, OrganizationRole::Member)
            .await?;

        let repo = self.org_repo();
        let rows = repo.list_members(org_id).await?;

        Ok(rows
            .into_iter()
            .map(|(m, role)| OrganizationMemberResponse {
                id: m.id,
                user_id: m.user_id,
                role,
                created_at: m.created_at,
            })
            .collect())
    }

    /// 将文件关联到组织（团队空间共享），仅成员可操作。
    ///
    /// 目前要求调用者至少是该组织的 Member，且是文件上传者；
    /// 这样可以避免随意将他人文件加入组织。
    pub async fn link_file_to_org(
        &self,
        actor_user_id: Uuid,
        org_id: Uuid,
        file_id: Uuid,
    ) -> Result<(), AppError> {
        // 确保调用者属于该组织
        self.ensure_role_at_least(org_id, actor_user_id, OrganizationRole::Member)
            .await?;

        // 验证文件属于当前用户（避免越权共享）
        let files_repo = SqlxFilesRepo::new(self.pool.clone());
        use crate::repositories::traits::FilesRepository;
        if !files_repo.belongs_to_user(file_id, actor_user_id).await? {
            return Err(AppError::Unauthorized);
        }

        let repo = self.org_repo();
        repo.link_file_to_org(org_id, file_id).await
    }

    /// 取消文件与组织的关联，仅 Admin 及以上可操作。
    pub async fn unlink_file_from_org(
        &self,
        actor_user_id: Uuid,
        org_id: Uuid,
        file_id: Uuid,
    ) -> Result<(), AppError> {
        self.ensure_role_at_least(org_id, actor_user_id, OrganizationRole::Admin)
            .await?;

        let repo = self.org_repo();
        repo.unlink_file_from_org(org_id, file_id).await
    }

    /// 列出组织下共享的所有文件（按创建时间倒序）。
    pub async fn list_org_files(
        &self,
        actor_user_id: Uuid,
        org_id: Uuid,
    ) -> Result<Vec<FileResponse>, AppError> {
        // 任何成员均可浏览团队文件
        self.ensure_role_at_least(org_id, actor_user_id, OrganizationRole::Member)
            .await?;

        let repo = self.org_repo();
        let files = repo.list_files_for_org(org_id).await?;
        Ok(files.into_iter().map(FileResponse::from).collect())
    }
}
