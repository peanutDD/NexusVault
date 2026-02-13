//! 组织与成员数据访问层
//!
//! 提供对 `organizations`、`organization_members` 与 `organization_files`
//! 表的常用操作，作为多租户与权限的基础。

use sqlx::PgPool;
use uuid::Uuid;

use crate::models::file::File;
use crate::models::organization::{Organization, OrganizationMember, OrganizationRole};
use crate::utils::AppError;

pub struct OrganizationsRepo {
    pub(crate) pool: PgPool,
}

impl OrganizationsRepo {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// 创建组织，并自动将创建者设为 Owner 成员。
    pub async fn create_organization(
        &self,
        name: &str,
        owner_user_id: Uuid,
    ) -> Result<Organization, AppError> {
        let org_id = Uuid::new_v4();
        let member_id = Uuid::new_v4();

        let mut tx = self.pool.begin().await?;

        let org: Organization = sqlx::query_as(
            "INSERT INTO organizations (id, name, owner_user_id)
             VALUES ($1, $2, $3)
             RETURNING id, name, owner_user_id, created_at, updated_at",
        )
        .bind(org_id)
        .bind(name)
        .bind(owner_user_id)
        .fetch_one(&mut *tx)
        .await?;

        sqlx::query(
            "INSERT INTO organization_members (id, org_id, user_id, role)
             VALUES ($1, $2, $3, 'owner')
             ON CONFLICT (org_id, user_id) DO UPDATE SET role = EXCLUDED.role",
        )
        .bind(member_id)
        .bind(org_id)
        .bind(owner_user_id)
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;

        Ok(org)
    }

    /// 列出当前用户所属的所有组织及其角色。
    pub async fn list_organizations_for_user(
        &self,
        user_id: Uuid,
    ) -> Result<Vec<(Organization, OrganizationRole)>, AppError> {
        let rows = sqlx::query_as::<
            _,
            (
                Uuid,
                String,
                Uuid,
                chrono::DateTime<chrono::Utc>,
                chrono::DateTime<chrono::Utc>,
                String,
            ),
        >(
            r#"
            SELECT
                o.id,
                o.name,
                o.owner_user_id,
                o.created_at,
                o.updated_at,
                m.role
            FROM organizations o
            JOIN organization_members m ON m.org_id = o.id
            WHERE m.user_id = $1
            ORDER BY o.created_at DESC
            "#,
        )
        .bind(user_id)
        .fetch_all(&self.pool)
        .await?;

        let result = rows
            .into_iter()
            .filter_map(
                |(id, name, owner_user_id, created_at, updated_at, role_str)| {
                    OrganizationRole::from_str(&role_str).map(|role| {
                        (
                            Organization {
                                id,
                                name,
                                owner_user_id,
                                created_at,
                                updated_at,
                            },
                            role,
                        )
                    })
                },
            )
            .collect();

        Ok(result)
    }

    /// 获取指定组织中用户的成员记录（含角色）。
    pub async fn get_membership(
        &self,
        org_id: Uuid,
        user_id: Uuid,
    ) -> Result<Option<(OrganizationMember, OrganizationRole)>, AppError> {
        let row: Option<OrganizationMember> = sqlx::query_as(
            "SELECT id, org_id, user_id, role, created_at, updated_at
             FROM organization_members
             WHERE org_id = $1 AND user_id = $2",
        )
        .bind(org_id)
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await?;

        Ok(row.and_then(|m| OrganizationRole::from_str(&m.role).map(|role| (m, role))))
    }

    /// 列出组织成员
    pub async fn list_members(
        &self,
        org_id: Uuid,
    ) -> Result<Vec<(OrganizationMember, OrganizationRole)>, AppError> {
        let rows: Vec<OrganizationMember> = sqlx::query_as(
            "SELECT id, org_id, user_id, role, created_at, updated_at
             FROM organization_members
             WHERE org_id = $1
             ORDER BY created_at ASC",
        )
        .bind(org_id)
        .fetch_all(&self.pool)
        .await?;

        Ok(rows
            .into_iter()
            .filter_map(|m| OrganizationRole::from_str(&m.role).map(|role| (m, role)))
            .collect())
    }

    /// 为组织新增成员或更新其角色。
    pub async fn upsert_member(
        &self,
        org_id: Uuid,
        user_id: Uuid,
        role: OrganizationRole,
    ) -> Result<(), AppError> {
        let id = Uuid::new_v4();
        sqlx::query(
            "INSERT INTO organization_members (id, org_id, user_id, role)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (org_id, user_id) DO UPDATE SET role = EXCLUDED.role, updated_at = NOW()",
        )
        .bind(id)
        .bind(org_id)
        .bind(user_id)
        .bind(role.as_str())
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    /// 将文件关联到组织（团队空间）
    pub async fn link_file_to_org(&self, org_id: Uuid, file_id: Uuid) -> Result<(), AppError> {
        let id = Uuid::new_v4();
        sqlx::query(
            "INSERT INTO organization_files (id, org_id, file_id)
             VALUES ($1, $2, $3)
             ON CONFLICT (org_id, file_id) DO NOTHING",
        )
        .bind(id)
        .bind(org_id)
        .bind(file_id)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    /// 取消文件与组织的关联
    pub async fn unlink_file_from_org(&self, org_id: Uuid, file_id: Uuid) -> Result<(), AppError> {
        sqlx::query("DELETE FROM organization_files WHERE org_id = $1 AND file_id = $2")
            .bind(org_id)
            .bind(file_id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    /// 列出组织下共享的所有文件
    pub async fn list_files_for_org(&self, org_id: Uuid) -> Result<Vec<File>, AppError> {
        let files: Vec<File> = sqlx::query_as(
            r#"
            SELECT f.*
            FROM files f
            JOIN organization_files of ON of.file_id = f.id
            WHERE of.org_id = $1
            ORDER BY f.created_at DESC
            "#,
        )
        .bind(org_id)
        .fetch_all(&self.pool)
        .await?;

        Ok(files)
    }
}
