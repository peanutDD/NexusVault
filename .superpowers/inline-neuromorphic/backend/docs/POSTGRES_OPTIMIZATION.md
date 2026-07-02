# PostgreSQL 性能自检与优化报告

> 📅 日期：2026-02-22  
> 🛠️ 基于技能：`postgres-all`, `postgresql-best-practices` (PlanetScale)

## 1. 概览

通过 PlanetScale 提供的 PostgreSQL 最佳实践指南，我们对后端数据库架构进行了深度自检。本次优化重点解决了高并发下的一致性问题、提升了大表查询性能，并增强了数据库的可观测性。

## 2. 核心优化项

### 🔒 2.1 并发一致性保护 (Concurrency Control)

**问题描述**：
在极高并发的上传场景下，"检查-然后-插入"（Check-then-Act）的应用层逻辑无法完全避免竞态条件，可能导致同一文件夹下出现重复文件名的记录。

**优化方案**：
利用 PostgreSQL 15+ 的 `UNIQUE NULLS NOT DISTINCT` 特性，在数据库层面实施强制唯一性约束。

- **迁移文件**：[`019_add_files_unique_constraint.sql`](../migrations/019_add_files_unique_constraint.sql)
- **技术细节**：
  ```sql
  ALTER TABLE files 
  ADD CONSTRAINT uq_files_user_folder_filename 
  UNIQUE NULLS NOT DISTINCT (user_id, folder_id, original_filename);
  ```
  此约束确保了即使 `folder_id` 为 `NULL`（根目录），`(user_id, NULL, filename)` 组合也是唯一的。

### 🚀 2.2 大表分页性能 (Pagination Performance)

**问题描述**：
随着文件数量增长至百万级，传统分页查询中的 `COUNT(*) OVER()` 操作会显著拖慢查询速度，即使用户只需要查看第一页数据。

**优化方案**：
引入“按需计数”策略，并结合游标分页（Cursor Pagination）。

- **代码变更**：[`FilesRepository::list`](../src/repositories/files.rs)
- **查询参数变更**：[`FileListQuery#include_total`](../src/models/file.rs)
- **优化逻辑**：
  1.  **游标分页（无限滚动）**：完全跳过总数计算，性能极大提升。
  2.  **传统分页**：新增 `include_total` 参数。前端可选择性关闭总数计算（例如在移动端或非首屏加载时），仅查询数据行。
  ```rust
  // 仅在非游标分页且显式请求 total 时才执行 COUNT(*)
  let should_count_total = !use_cursor_pagination && query.include_total.unwrap_or(true);
  ```

### 👁️ 2.3 可观测性增强 (Observability)

**问题描述**：
缺乏数据库层面的性能监控，难以定位慢查询和高频低效 SQL。

**优化方案**：
启用 PostgreSQL 官方推荐的 `pg_stat_statements` 扩展，实时追踪 SQL 执行统计。

- **配置变更**：
  - [`docker-compose.yml`](../../docker-compose.yml): 添加启动参数 `-c shared_preload_libraries=pg_stat_statements`
  - [迁移文件](../migrations/020_enable_pg_stat_statements.sql): 执行 `CREATE EXTENSION`
- **权限说明**：
  - 生产/托管数据库通常限制 `CREATE EXTENSION` 权限；若应用用户无权限，该迁移会失败并阻塞启动。
  - 解决方式：由数据库管理员预先启用扩展（或用具备权限的账号执行迁移），并配置 `shared_preload_libraries`。
- **收益**：
  可通过查询 `pg_stat_statements` 视图获取最耗时的 SQL 语句，为后续索引优化提供数据支持。

## 3. 已有架构亮点自检

除了新增优化外，本次自检确认了现有架构中已落实的最佳实践：

*   **✅ 全文检索**：使用 `pg_trgm` GIN 索引加速模糊查询 (`ILIKE`)，避免全表扫描。
*   **✅ 语义搜索**：集成 `pgvector` 扩展与 IVFFlat 索引，支持高性能向量相似度匹配。
*   **✅ 连接池防护**：配置了 `statement_timeout`，防止单次慢查询拖垮整个连接池（雪崩效应）。
*   **✅ 主键策略**：全站使用 UUID (`uuid-ossp`)，避免了序列 ID 的安全风险和合并冲突。

## 4. 下一步建议

1.  **定期 VACUUM**：确保生产环境数据库开启自动 VACUUM，以维持索引性能并回收空间。
2.  **慢查询监控**：结合新启用的 `pg_stat_statements`，建议在 Grafana 或类似工具中建立数据库性能仪表盘。

## 5. 2026-03-01 迁移安全与并发一致性补强（补充）

本次补强聚焦“迁移可用性 + 在线索引维护 + 并发一致性”，详细设计与落地清单见：

- [`DB_MIGRATION_SAFETY.md`](./DB_MIGRATION_SAFETY.md)

落地要点概览：

- **扩展依赖**：补齐 `pgcrypto`，避免 `gen_random_uuid()` 在新环境迁移失败：[`024_enable_pgcrypto.sql`](file:///Users/tyone/github/upload-download-util/backend/migrations/024_enable_pgcrypto.sql)
- **并发一致性（后台任务 dedupe）**：唯一部分索引 + `INSERT ... ON CONFLICT ... DO NOTHING RETURNING ...`，根治并发重复入队：[`025_background_tasks_active_dedupe_unique.sql`](file:///Users/tyone/github/upload-download-util/backend/migrations/025_background_tasks_active_dedupe_unique.sql)、[`task_queue.rs`](file:///Users/tyone/github/upload-download-util/backend/src/services/task_queue.rs#L182-L255)
- **CONCURRENTLY 路线**：将 `CREATE/DROP INDEX CONCURRENTLY` 拆为 `-- no-transaction` 且单语句迁移，降低大表维护锁风险（任务队列表索引与 embedding 向量索引）：[`backend/migrations`](file:///Users/tyone/github/upload-download-util/backend/migrations)
