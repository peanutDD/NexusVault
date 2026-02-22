-- 修复并发上传导致的文件名重复问题

-- 1. 清理重复数据：保留最新的一条（按 updated_at DESC, created_at DESC, id DESC 排序）
WITH duplicates AS (
    SELECT id,
           ROW_NUMBER() OVER (
               PARTITION BY user_id, folder_id, original_filename
               ORDER BY updated_at DESC, created_at DESC, id DESC
           ) as rnum
    FROM files
)
DELETE FROM files
WHERE id IN (
    SELECT id FROM duplicates WHERE rnum > 1
);

-- 2. 添加唯一约束：确保同一文件夹下的文件名唯一（包括根目录 folder_id 为 NULL 的情况）
-- UNIQUE NULLS NOT DISTINCT 是 PostgreSQL 15+ 的特性，它将 NULL 视为相等的值
ALTER TABLE files 
ADD CONSTRAINT uq_files_user_folder_filename 
UNIQUE NULLS NOT DISTINCT (user_id, folder_id, original_filename);
