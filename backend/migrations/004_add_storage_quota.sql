-- Add storage quota management

-- Add storage_quota column to users table (in bytes, NULL means unlimited)
ALTER TABLE users ADD COLUMN IF NOT EXISTS storage_quota BIGINT DEFAULT NULL;

-- Add comment
COMMENT ON COLUMN users.storage_quota IS 'Storage quota in bytes. NULL means unlimited.';
