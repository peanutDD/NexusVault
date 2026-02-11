-- ============================================================================
-- 文件版本管理表
-- ============================================================================
-- 功能：支持文件版本管理，自动保留最近 2 个版本
-- 策略：上传同名文件时自动创建新版本，旧版本保留为历史版本

CREATE TABLE file_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL, -- 版本号，从 1 开始递增
    filename VARCHAR(255) NOT NULL, -- 存储文件名
    original_filename VARCHAR(255) NOT NULL, -- 原始文件名
    file_path TEXT NOT NULL, -- 文件存储路径
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    storage_backend VARCHAR(20) NOT NULL DEFAULT 'local',
    content_sha256 VARCHAR(64), -- 文件内容 SHA-256
    label VARCHAR(255), -- 版本标签/备注（用户自定义）
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- 确保同一文件的版本号唯一
    UNIQUE(file_id, version_number)
);

-- 索引：按文件 ID 查询版本列表（按版本号降序）
CREATE INDEX idx_file_versions_file_id ON file_versions(file_id, version_number DESC);

-- 索引：按用户 ID 查询（用于清理）
CREATE INDEX idx_file_versions_user_id ON file_versions(user_id);

-- 索引：按创建时间查询（用于版本清理）
CREATE INDEX idx_file_versions_created_at ON file_versions(created_at);

COMMENT ON TABLE file_versions IS '文件版本历史记录表，保留文件的旧版本';
COMMENT ON COLUMN file_versions.version_number IS '版本号，从 1 开始递增，数字越大表示越新';
COMMENT ON COLUMN file_versions.label IS '版本标签/备注，用户可自定义';
