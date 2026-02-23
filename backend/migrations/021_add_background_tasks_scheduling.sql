ALTER TABLE background_tasks
  ADD COLUMN IF NOT EXISTS next_run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_background_tasks_ready
  ON background_tasks (task_type, status, next_run_at, created_at);

CREATE INDEX IF NOT EXISTS idx_background_tasks_locked_until
  ON background_tasks (task_type, status, locked_until);
