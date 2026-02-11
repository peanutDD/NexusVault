-- 为高频查询补充复合索引，提升列表/筛选/排序性能
--
-- 设计原则：
-- - 优先为「WHERE + ORDER BY」组合查询创建复合索引
-- - 索引列顺序：等值条件在前，范围条件在后，排序字段在最后
-- - 避免过度索引（单列索引已覆盖的场景不再重复创建）

-- ============================================================================
-- files 表：文件列表查询优化
-- ============================================================================

-- 按文件夹列表 + 按创建时间排序（list_by_folder 与 list 中 folder_id 筛选）
-- 查询模式：WHERE user_id = $1 AND folder_id = $2 ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_files_user_folder_created_desc
ON files(user_id, folder_id, created_at DESC)
WHERE folder_id IS NOT NULL;

-- 根目录文件列表（folder_id IS NULL）+ 按创建时间排序
-- 查询模式：WHERE user_id = $1 AND folder_id IS NULL ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_files_user_null_folder_created_desc
ON files(user_id, created_at DESC)
WHERE folder_id IS NULL;

-- 按 MIME 类型筛选 + 按创建时间排序（list 中 mime_type 筛选）
-- 查询模式：WHERE user_id = $1 AND mime_type = $2 ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_files_user_mime_created_desc
ON files(user_id, mime_type, created_at DESC);

-- 按分类筛选 + 按创建时间排序（list 中 category 筛选）
-- 查询模式：WHERE user_id = $1 AND category = $2 ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_files_user_category_created_desc
ON files(user_id, category, created_at DESC)
WHERE category IS NOT NULL;

-- 按文件名排序（list 中 sort_by = filename）
-- 查询模式：WHERE user_id = $1 ORDER BY original_filename ASC/DESC
CREATE INDEX IF NOT EXISTS idx_files_user_filename_asc
ON files(user_id, original_filename ASC);

CREATE INDEX IF NOT EXISTS idx_files_user_filename_desc
ON files(user_id, original_filename DESC);

-- 按文件大小排序（list 中 sort_by = file_size）
-- 查询模式：WHERE user_id = $1 ORDER BY file_size ASC/DESC
CREATE INDEX IF NOT EXISTS idx_files_user_size_asc
ON files(user_id, file_size ASC);

CREATE INDEX IF NOT EXISTS idx_files_user_size_desc
ON files(user_id, file_size DESC);

-- ============================================================================
-- file_shares 表：分享查询优化
-- ============================================================================

-- 按文件 ID + 用户 ID 查找分享（find_by_file_and_user）
-- 查询模式：WHERE file_id = $1 AND user_id = $2
CREATE INDEX IF NOT EXISTS idx_file_shares_file_user
ON file_shares(file_id, user_id);

-- 按用户列出分享 + 按创建时间排序（list_by_user，预留）
-- 查询模式：WHERE user_id = $1 ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_file_shares_user_created_desc
ON file_shares(user_id, created_at DESC);

-- ============================================================================
-- folders 表：文件夹查询优化
-- ============================================================================

-- 按父文件夹列出子文件夹 + 按名称排序（list_by_parent）
-- 查询模式：WHERE user_id = $1 AND parent_id = $2 ORDER BY name
CREATE INDEX IF NOT EXISTS idx_folders_user_parent_name
ON folders(user_id, parent_id, name);

-- 根目录文件夹列表 + 按名称排序
-- 查询模式：WHERE user_id = $1 AND parent_id IS NULL ORDER BY name
CREATE INDEX IF NOT EXISTS idx_folders_user_null_parent_name
ON folders(user_id, name)
WHERE parent_id IS NULL;

-- 检查同名文件夹（name_exists_in_parent）
-- 查询模式：WHERE user_id = $1 AND parent_id = $2 AND name = $3
-- 已有 idx_folders_user_parent_name 覆盖，但可以添加唯一约束优化（已存在 UNIQUE NULLS NOT DISTINCT）

-- ============================================================================
-- organization_files 表：组织文件查询优化
-- ============================================================================

-- 按组织列出文件（list_files_for_org）
-- 查询模式：JOIN organization_files ON file_id WHERE org_id = $1 ORDER BY files.created_at DESC
-- 注意：由于排序字段在 files 表，主要依赖 files 表的 (user_id, created_at DESC) 索引
-- 这里仅优化 organization_files 的 JOIN 查找（已有 idx_organization_files_org_id）
-- 如需进一步优化，可考虑在应用层按 org_id 先查出 file_ids，再按 file_ids 查 files 表

-- ============================================================================
-- organization_members 表：成员查询优化
-- ============================================================================

-- 按用户列出所属组织（list_organizations_for_user）
-- 查询模式：WHERE user_id = $1
-- 已有 idx_organization_members_user_id，无需额外索引

-- 按组织列出成员（list_members）
-- 查询模式：WHERE org_id = $1
-- 已有 idx_organization_members_org_id，无需额外索引

-- ============================================================================
-- 索引使用说明
-- ============================================================================
-- 
-- 1. files 表：
--    - 文件列表查询（list）会根据筛选条件自动选择最合适的索引：
--      * 仅按 user_id：idx_files_user_created
--      * 按 folder_id：idx_files_user_folder_created_desc 或 idx_files_user_null_folder_created_desc
--      * 按 mime_type：idx_files_user_mime_created_desc
--      * 按 category：idx_files_user_category_created_desc
--      * 按 filename 排序：idx_files_user_filename_asc/desc
--      * 按 file_size 排序：idx_files_user_size_asc/desc
--
-- 2. file_shares 表：
--    - find_by_file_and_user：idx_file_shares_file_user
--    - list_by_user：idx_file_shares_user_created_desc
--
-- 3. folders 表：
--    - list_by_parent：idx_folders_user_parent_name 或 idx_folders_user_null_parent_name
--    - name_exists_in_parent：利用 UNIQUE 约束 + idx_folders_user_parent_name
--
-- 4. organization_files 表：
--    - list_files_for_org：idx_organization_files_org_created（辅助）+ files.created_at 索引
