-- 添加搜索优化索引
-- 使用 pg_trgm 扩展支持 ILIKE 模糊搜索加速

-- 启用三元组扩展（如果不存在）
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 为文件名添加 GIN 三元组索引，加速 ILIKE 搜索
CREATE INDEX IF NOT EXISTS idx_files_original_filename_trgm 
ON files USING GIN (original_filename gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_files_filename_trgm 
ON files USING GIN (filename gin_trgm_ops);

-- 添加 category 索引（用于分类筛选）
CREATE INDEX IF NOT EXISTS idx_files_user_category 
ON files(user_id, category);

-- 添加 folder_id 索引（用于文件夹筛选）
CREATE INDEX IF NOT EXISTS idx_files_user_folder 
ON files(user_id, folder_id);
