-- 为文件表添加文件夹关联字段

-- 添加 folder_id 列
ALTER TABLE files ADD COLUMN folder_id UUID REFERENCES folders(id) ON DELETE SET NULL;

-- 索引：按文件夹查询文件
CREATE INDEX idx_files_folder_id ON files(folder_id);

-- 索引：用户 + 文件夹复合索引（常用查询模式）
CREATE INDEX idx_files_user_folder ON files(user_id, folder_id);

COMMENT ON COLUMN files.folder_id IS '所属文件夹ID，NULL表示根目录';
