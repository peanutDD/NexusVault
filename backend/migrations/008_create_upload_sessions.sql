-- Chunked upload sessions for resumable uploads
CREATE TABLE upload_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    filename VARCHAR(512) NOT NULL,
    mime_type VARCHAR(256) NOT NULL,
    total_size BIGINT NOT NULL,
    chunk_size INTEGER NOT NULL,
    temp_path VARCHAR(1024) NOT NULL,
    uploaded_parts INTEGER[] DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours')
);

CREATE INDEX idx_upload_sessions_user_id ON upload_sessions(user_id);
CREATE INDEX idx_upload_sessions_expires_at ON upload_sessions(expires_at);
