ALTER TABLE audit_events
DROP CONSTRAINT IF EXISTS audit_events_file_id_fkey;

ALTER TABLE audit_events
ADD COLUMN IF NOT EXISTS api_token_id UUID REFERENCES api_tokens(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_audit_events_user_api_token_created
    ON audit_events(user_id, api_token_id, created_at DESC, id DESC)
    WHERE api_token_id IS NOT NULL;
