-- 启用查询性能监控
-- 需要先在数据库配置中启用 shared_preload_libraries = 'pg_stat_statements'
-- 参见 docker-compose.yml

CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
