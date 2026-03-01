-- no-transaction
-- 背景任务去重：用 CONCURRENTLY 创建新的唯一部分索引（新名字），避免维护期锁写。
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uq_background_tasks_active_dedupe_concurrently
ON background_tasks (task_type, dedupe_key)
WHERE dedupe_key IS NOT NULL
  AND status IN ('pending', 'running');
