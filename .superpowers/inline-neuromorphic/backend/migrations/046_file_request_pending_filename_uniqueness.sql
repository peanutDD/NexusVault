-- Pending File Request uploads are hidden review records and may share a
-- filename with an already approved file. Only approved, active files enforce
-- the normal per-folder filename uniqueness rule.

DROP INDEX IF EXISTS uq_files_active_user_folder_filename;
DROP INDEX IF EXISTS uq_files_active_user_root_filename;

CREATE UNIQUE INDEX IF NOT EXISTS uq_files_approved_user_folder_filename
ON files(user_id, folder_id, original_filename)
WHERE deleted_at IS NULL
  AND review_status = 'approved'
  AND folder_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_files_approved_user_root_filename
ON files(user_id, original_filename)
WHERE deleted_at IS NULL
  AND review_status = 'approved'
  AND folder_id IS NULL;
