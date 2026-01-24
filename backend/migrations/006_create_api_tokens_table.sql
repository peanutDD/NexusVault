-- Create API tokens table for programmatic access

CREATE TABLE api_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) UNIQUE NOT NULL, -- Hashed token for security
    name VARCHAR(255) NOT NULL, -- User-friendly name for the token
    last_used_at TIMESTAMP WITH TIME ZONE, -- Track last usage
    expires_at TIMESTAMP WITH TIME ZONE, -- Optional expiration
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_api_tokens_user_id ON api_tokens(user_id);
CREATE INDEX idx_api_tokens_token_hash ON api_tokens(token_hash);
CREATE INDEX idx_api_tokens_expires_at ON api_tokens(expires_at);

COMMENT ON TABLE api_tokens IS 'API tokens for programmatic access';
COMMENT ON COLUMN api_tokens.token_hash IS 'SHA-256 hash of the token (token is only shown once on creation)';
COMMENT ON COLUMN api_tokens.name IS 'User-friendly name to identify the token';
COMMENT ON COLUMN api_tokens.last_used_at IS 'Timestamp of last successful API call using this token';
