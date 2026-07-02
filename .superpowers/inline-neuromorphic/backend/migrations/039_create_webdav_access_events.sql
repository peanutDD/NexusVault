CREATE TABLE IF NOT EXISTS webdav_access_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    api_token_id UUID REFERENCES api_tokens(id) ON DELETE SET NULL,
    method TEXT NOT NULL,
    path TEXT NOT NULL,
    status_code INTEGER NOT NULL,
    read_only BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_webdav_access_events_user_created
ON webdav_access_events(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_webdav_access_events_token_created
ON webdav_access_events(api_token_id, created_at DESC);
