-- no-transaction
-- 任务调度/领取：并发创建 ready 索引（新名字），降低维护期锁风险。
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_background_tasks_ready_concurrently
ON background_tasks (task_type, status, next_run_at, created_at);
