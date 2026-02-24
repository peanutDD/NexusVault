-- 为 keyset/cursor 分页补充复合索引（sort_column + id）
--
-- 目的：
-- - 支持 ORDER BY sort_column, id 的范围扫描
-- - 避免深分页 OFFSET 带来的性能退化
--
-- 注意：
-- - 这里为 ASC/DESC 各建一条索引以匹配常用排序；如后续确认只用某一方向，可删除另一条以减少写放大

-- created_at（默认排序）
CREATE INDEX IF NOT EXISTS idx_files_user_folder_created_id_desc
ON files(user_id, folder_id, created_at DESC, id DESC)
WHERE folder_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_files_user_null_folder_created_id_desc
ON files(user_id, created_at DESC, id DESC)
WHERE folder_id IS NULL;

-- filename（original_filename）
CREATE INDEX IF NOT EXISTS idx_files_user_filename_id_asc
ON files(user_id, original_filename ASC, id ASC);

CREATE INDEX IF NOT EXISTS idx_files_user_filename_id_desc
ON files(user_id, original_filename DESC, id DESC);

-- file_size
CREATE INDEX IF NOT EXISTS idx_files_user_size_id_asc
ON files(user_id, file_size ASC, id ASC);

CREATE INDEX IF NOT EXISTS idx_files_user_size_id_desc
ON files(user_id, file_size DESC, id DESC);

