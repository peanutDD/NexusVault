-- File Request inbox review flow.
-- Public uploads are hidden until the owner approves them.

ALTER TABLE files
ADD COLUMN IF NOT EXISTS review_status VARCHAR(20) NOT NULL DEFAULT 'approved';

DO $$
BEGIN
    ALTER TABLE files
    ADD CONSTRAINT files_review_status_check
    CHECK (review_status IN ('approved', 'pending', 'rejected'));
EXCEPTION WHEN duplicate_object THEN
    NULL;
END $$;

CREATE TABLE IF NOT EXISTS file_request_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID NOT NULL REFERENCES file_requests(id) ON DELETE CASCADE,
    submitter_email VARCHAR(320),
    submitter_note TEXT,
    ip_address TEXT,
    user_agent TEXT,
    file_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE file_request_uploads
ADD COLUMN IF NOT EXISTS submission_id UUID REFERENCES file_request_submissions(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS reviewer_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS review_note TEXT,
ADD COLUMN IF NOT EXISTS scan_status VARCHAR(20) NOT NULL DEFAULT 'not_scanned',
ADD COLUMN IF NOT EXISTS scan_message TEXT;

UPDATE file_request_uploads
SET status = 'approved'
WHERE status = 'uploaded';

UPDATE file_request_uploads
SET scan_status = 'not_scanned'
WHERE scan_status IS NULL;

DO $$
BEGIN
    ALTER TABLE file_request_uploads
    ADD CONSTRAINT file_request_uploads_status_check
    CHECK (status IN ('pending', 'approved', 'rejected', 'quarantined'));
EXCEPTION WHEN duplicate_object THEN
    NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE file_request_uploads
    ADD CONSTRAINT file_request_uploads_scan_status_check
    CHECK (scan_status IN ('not_scanned', 'clean', 'infected', 'failed', 'skipped'));
EXCEPTION WHEN duplicate_object THEN
    NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_files_user_review_folder_created
    ON files(user_id, review_status, folder_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_file_request_submissions_request_created
    ON file_request_submissions(request_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_file_request_uploads_submission_created
    ON file_request_uploads(submission_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_file_request_uploads_status_created
    ON file_request_uploads(status, created_at DESC);
