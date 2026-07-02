-- no-transaction
-- 背景任务去重：删除旧的非 CONCURRENTLY 创建的索引（若存在），回收空间。
DROP INDEX CONCURRENTLY IF EXISTS uq_background_tasks_active_dedupe;
