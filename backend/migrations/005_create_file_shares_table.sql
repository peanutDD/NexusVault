-- Create file shares table for sharing functionality

CREATE TABLE file_shares (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    share_token VARCHAR(64) UNIQUE NOT NULL,
    password_hash VARCHAR(255), -- Optional password protection
    expires_at TIMESTAMP WITH TIME ZONE, -- Optional expiration
    max_downloads INTEGER, -- Optional download limit
    download_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_file_shares_token ON file_shares(share_token);
CREATE INDEX idx_file_shares_file_id ON file_shares(file_id);
CREATE INDEX idx_file_shares_user_id ON file_shares(user_id);
