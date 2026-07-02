CREATE TABLE IF NOT EXISTS direct_upload_sessions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    upload_id TEXT NOT NULL,
    object_key TEXT NOT NULL,
    part_size BIGINT NOT NULL,
    content_sha256 TEXT,
    folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_direct_upload_sessions_expires_at
ON direct_upload_sessions(expires_at);

CREATE INDEX IF NOT EXISTS idx_direct_upload_sessions_user
ON direct_upload_sessions(user_id, created_at DESC);
