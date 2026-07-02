-- no-transaction
-- 任务 lease 回收：并发创建 locked_until 索引（新名字），降低维护期锁风险。
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_background_tasks_locked_until_concurrently
ON background_tasks (task_type, status, locked_until);
