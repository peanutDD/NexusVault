-- Productized versions, share center, file requests, and tags/collections.

ALTER TABLE files
    ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS last_opened_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS share_access_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    share_id UUID NOT NULL REFERENCES file_shares(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_type VARCHAR(16) NOT NULL CHECK (event_type IN ('access', 'download')),
    status INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_share_access_events_share_created
    ON share_access_events(share_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_share_access_events_user_created
    ON share_access_events(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS file_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,
    token_hash VARCHAR(64) UNIQUE NOT NULL,
    token_prefix VARCHAR(12) NOT NULL,
    title VARCHAR(120) NOT NULL,
    description TEXT,
    allowed_mime_prefixes TEXT[] NOT NULL DEFAULT '{}',
    max_file_size BIGINT,
    max_uploads INTEGER,
    upload_count INTEGER NOT NULL DEFAULT 0,
    expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_file_requests_user_created
    ON file_requests(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_file_requests_token_hash
    ON file_requests(token_hash);

CREATE TABLE IF NOT EXISTS file_request_uploads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID NOT NULL REFERENCES file_requests(id) ON DELETE CASCADE,
    file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'uploaded',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_file_request_uploads_request_created
    ON file_request_uploads(request_id, created_at DESC);

CREATE TABLE IF NOT EXISTS file_tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(80) NOT NULL,
    color VARCHAR(32),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_file_tags_user_name
    ON file_tags(user_id, lower(name));

CREATE TABLE IF NOT EXISTS file_tag_assignments (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES file_tags(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(user_id, file_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_file_tag_assignments_file
    ON file_tag_assignments(file_id);

CREATE INDEX IF NOT EXISTS idx_file_tag_assignments_tag
    ON file_tag_assignments(tag_id);
