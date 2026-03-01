-- no-transaction
-- 删除旧的 locked_until 索引（若存在），回收空间。
DROP INDEX CONCURRENTLY IF EXISTS idx_background_tasks_locked_until;
