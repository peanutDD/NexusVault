-- 后台任务表：用于 GIF 转码、缩略图生成等资源密集型异步任务

CREATE TABLE IF NOT EXISTS background_tasks (
  id UUID PRIMARY KEY,
  -- 任务类型，例如：gif_preview, thumbnail_regen
  task_type TEXT NOT NULL,
  -- 自定义业务负载，通常为 JSON（例如 { "file_id": "...", "user_id": "..." }）
  payload JSONB NOT NULL,
  -- pending | running | succeeded | failed
  status TEXT NOT NULL DEFAULT 'pending',
  -- 已尝试执行次数
  attempts INTEGER NOT NULL DEFAULT 0,
  -- 最近一次错误信息（仅服务端排查使用）
  last_error TEXT,
  -- 用于幂等：避免对同一业务实体重复排队（例如同一 file_id 的 gif_preview）
  dedupe_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_background_tasks_status_created_at
  ON background_tasks(status, created_at);

CREATE INDEX IF NOT EXISTS idx_background_tasks_dedupe_key
  ON background_tasks(dedupe_key)
  WHERE dedupe_key IS NOT NULL;

