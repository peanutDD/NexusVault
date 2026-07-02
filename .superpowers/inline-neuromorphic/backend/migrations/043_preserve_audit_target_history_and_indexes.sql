ALTER TABLE audit_events
DROP CONSTRAINT IF EXISTS audit_events_folder_id_fkey;

ALTER TABLE audit_events
DROP CONSTRAINT IF EXISTS audit_events_share_id_fkey;

ALTER TABLE audit_events
DROP CONSTRAINT IF EXISTS audit_events_file_request_id_fkey;

ALTER TABLE audit_events
DROP CONSTRAINT IF EXISTS audit_events_api_token_id_fkey;

CREATE INDEX IF NOT EXISTS idx_audit_events_user_folder_created
    ON audit_events(user_id, folder_id, created_at DESC, id DESC)
    WHERE folder_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_events_user_share_created
    ON audit_events(user_id, share_id, created_at DESC, id DESC)
    WHERE share_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_events_user_file_request_created
    ON audit_events(user_id, file_request_id, created_at DESC, id DESC)
    WHERE file_request_id IS NOT NULL;
