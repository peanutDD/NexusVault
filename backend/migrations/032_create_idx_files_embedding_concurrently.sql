-- no-transaction
-- files.embedding 的 ivfflat 索引：并发创建（新名字），降低维护期锁风险。
-- lists=100 沿用 018 的默认值。
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_files_embedding_concurrently
ON files
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100)
WHERE embedding IS NOT NULL;
