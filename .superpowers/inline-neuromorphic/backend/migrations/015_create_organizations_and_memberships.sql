-- 多租户与权限：组织（Organization）与成员（Membership）基础表
-- 
-- 设计说明：
-- - organizations：租户/团队实体，由创建者作为 Owner 持有
-- - organization_members：组织成员及其角色（owner/admin/member）
-- - organization_files：组织与文件的关联表，用于「团队空间」共享文件
--
-- 约束与约定：
-- - 一个用户可以属于多个组织，在不同组织中拥有不同角色
-- - 每个组织至少有一名 owner（通过应用层保证）
-- - organization_files 仅建立关联，不改变 files.user_id（仍记录上传者）

CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS organization_members (
    id UUID PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (org_id, user_id)
);

-- 组织与文件的关联，用于「团队空间」共享文件
CREATE TABLE IF NOT EXISTS organization_files (
    id UUID PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (org_id, file_id)
);

CREATE INDEX IF NOT EXISTS idx_organization_members_user_id
    ON organization_members (user_id);

CREATE INDEX IF NOT EXISTS idx_organization_members_org_id
    ON organization_members (org_id);

CREATE INDEX IF NOT EXISTS idx_organization_files_org_id
    ON organization_files (org_id);

CREATE INDEX IF NOT EXISTS idx_organization_files_file_id
    ON organization_files (file_id);

