ALTER TABLE files
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_files_user_deleted_at
ON files(user_id, deleted_at DESC)
WHERE deleted_at IS NOT NULL;

ALTER TABLE files
DROP CONSTRAINT IF EXISTS uq_files_user_folder_filename;

CREATE UNIQUE INDEX IF NOT EXISTS uq_files_active_user_folder_filename
ON files(user_id, folder_id, original_filename)
WHERE deleted_at IS NULL
  AND folder_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_files_active_user_root_filename
ON files(user_id, original_filename)
WHERE deleted_at IS NULL
  AND folder_id IS NULL;
