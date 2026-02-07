-- 秒传（文件指纹）：按 content_sha256 + file_size 判断是否已有相同文件，可复用存储
ALTER TABLE files ADD COLUMN IF NOT EXISTS content_sha256 VARCHAR(64) DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_files_content_sha256 ON files(content_sha256) WHERE content_sha256 IS NOT NULL;

COMMENT ON COLUMN files.content_sha256 IS '文件内容 SHA-256 十六进制，用于秒传与去重';
