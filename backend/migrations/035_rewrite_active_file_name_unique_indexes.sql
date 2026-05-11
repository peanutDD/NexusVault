DROP INDEX IF EXISTS uq_files_active_user_folder_filename;

CREATE UNIQUE INDEX IF NOT EXISTS uq_files_active_user_folder_filename
ON files(user_id, folder_id, original_filename)
WHERE deleted_at IS NULL
  AND folder_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_files_active_user_root_filename
ON files(user_id, original_filename)
WHERE deleted_at IS NULL
  AND folder_id IS NULL;
