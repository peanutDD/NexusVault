-- no-transaction
-- 删除旧的 embedding 索引（若存在），回收空间。
DROP INDEX CONCURRENTLY IF EXISTS idx_files_embedding;
