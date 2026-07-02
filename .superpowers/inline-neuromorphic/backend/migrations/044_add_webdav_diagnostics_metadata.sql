ALTER TABLE webdav_access_events
ADD COLUMN IF NOT EXISTS ip_address TEXT,
ADD COLUMN IF NOT EXISTS user_agent TEXT;

CREATE INDEX IF NOT EXISTS idx_webdav_access_events_user_token_created
ON webdav_access_events(user_id, api_token_id, created_at DESC)
WHERE api_token_id IS NOT NULL;
