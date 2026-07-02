-- Add additional indexes for better query performance
-- Note: Some indexes already exist in 002_create_files_table.sql

-- Index for user_id + mime_type (for filtering by type)
CREATE INDEX IF NOT EXISTS idx_files_user_mime ON files(user_id, mime_type);

-- Index for file_size filtering (for size range queries)
CREATE INDEX IF NOT EXISTS idx_files_user_size ON files(user_id, file_size);

-- Index for date range filtering (already have created_at index, but add composite for user + date)
-- The idx_files_user_created already covers this, but we can add one for date range specifically
CREATE INDEX IF NOT EXISTS idx_files_user_created_at ON files(user_id, created_at);
