CREATE UNIQUE INDEX IF NOT EXISTS uq_background_tasks_active_dedupe
ON background_tasks (task_type, dedupe_key)
WHERE dedupe_key IS NOT NULL
  AND status IN ('pending', 'running');
