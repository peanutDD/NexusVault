-- Add category column for file organization (virtual folder / classification)
-- NULL or empty = uncategorized

ALTER TABLE files ADD COLUMN IF NOT EXISTS category VARCHAR(255) DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_files_user_category ON files(user_id, category);

COMMENT ON COLUMN files.category IS 'User-defined category/folder for organization. NULL = uncategorized.';
