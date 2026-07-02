-- ============================================================================
-- 语义搜索支持：添加向量嵌入列和 pgvector 扩展
-- ============================================================================

-- 安装 pgvector 扩展（如果尚未安装）
CREATE EXTENSION IF NOT EXISTS vector;

-- 在 files 表中添加 embedding 列（384 维向量，对应 all-MiniLM-L6-v2 模型）
ALTER TABLE files ADD COLUMN IF NOT EXISTS embedding vector(384);

-- 创建向量索引（IVFFlat + 余弦相似度）
-- lists = 100 是一个合理的默认值，可根据实际数据量调整
CREATE INDEX IF NOT EXISTS idx_files_embedding ON files
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100)
WHERE embedding IS NOT NULL;

-- 添加列注释
COMMENT ON COLUMN files.embedding IS '文件名和内容向量嵌入（用于语义搜索），使用 Hugging Face 模型生成，384 维';
