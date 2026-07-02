-- 秒传查询：WHERE content_sha256 = $1 AND file_size = $2 LIMIT 1，复合索引避免全表扫描
CREATE INDEX IF NOT EXISTS idx_files_content_sha256_file_size
ON files(content_sha256, file_size)
WHERE content_sha256 IS NOT NULL;

-- count_by_file_path：删除/秒传时按 file_path 计数，单列索引加速
CREATE INDEX IF NOT EXISTS idx_files_file_path ON files(file_path);
