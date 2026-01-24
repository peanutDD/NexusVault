-- 创建数据库和用户的 SQL 脚本
-- 使用方法: psql postgres -f create_database.sql

-- 创建数据库（如果不存在）
SELECT 'CREATE DATABASE file_storage'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'file_storage')\gexec

-- 连接到新创建的数据库
\c file_storage

-- 创建用户（如果不存在）
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_user WHERE usename = 'file_storage') THEN
        CREATE USER file_storage WITH PASSWORD 'file_storage_password';
    END IF;
END
$$;

-- 授予权限
GRANT ALL PRIVILEGES ON DATABASE file_storage TO file_storage;

-- 授予 schema 权限
GRANT ALL ON SCHEMA public TO file_storage;
