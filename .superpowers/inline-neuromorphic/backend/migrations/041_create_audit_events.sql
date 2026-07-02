CREATE TABLE IF NOT EXISTS audit_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    actor_type VARCHAR(32) NOT NULL,
    actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    source VARCHAR(32) NOT NULL,
    event_type VARCHAR(64) NOT NULL,
    target_type VARCHAR(32) NOT NULL,
    file_id UUID REFERENCES files(id) ON DELETE SET NULL,
    folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,
    share_id UUID REFERENCES file_shares(id) ON DELETE SET NULL,
    file_request_id UUID REFERENCES file_requests(id) ON DELETE SET NULL,
    status INTEGER,
    ip_address TEXT,
    user_agent TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_events_user_created
    ON audit_events(user_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_audit_events_user_file_created
    ON audit_events(user_id, file_id, created_at DESC, id DESC)
    WHERE file_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_events_user_source_created
    ON audit_events(user_id, source, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_audit_events_user_event_type_created
    ON audit_events(user_id, event_type, created_at DESC, id DESC);
