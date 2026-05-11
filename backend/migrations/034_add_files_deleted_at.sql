ALTER TABLE files
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_files_user_deleted_at
ON files(user_id, deleted_at DESC)
WHERE deleted_at IS NOT NULL;

ALTER TABLE files
DROP CONSTRAINT IF EXISTS uq_files_user_folder_filename;

CREATE UNIQUE INDEX IF NOT EXISTS uq_files_active_user_folder_filename
ON files(user_id, folder_id, original_filename) NULLS NOT DISTINCT
WHERE deleted_at IS NULL;
