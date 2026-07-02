-- 创建文件夹表
-- 支持多层嵌套的文件夹结构

CREATE TABLE folders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    parent_id UUID REFERENCES folders(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    -- 同一父文件夹下名称唯一（根目录下 parent_id 为 NULL）
    UNIQUE NULLS NOT DISTINCT (user_id, parent_id, name)
);

-- 索引：按用户查询
CREATE INDEX idx_folders_user_id ON folders(user_id);

-- 索引：按父文件夹查询子文件夹
CREATE INDEX idx_folders_parent_id ON folders(parent_id);

-- 索引：用户 + 父文件夹复合索引（常用查询模式）
CREATE INDEX idx_folders_user_parent ON folders(user_id, parent_id);

COMMENT ON TABLE folders IS '文件夹表，支持多层嵌套结构';
COMMENT ON COLUMN folders.parent_id IS '父文件夹ID，NULL表示根目录';
