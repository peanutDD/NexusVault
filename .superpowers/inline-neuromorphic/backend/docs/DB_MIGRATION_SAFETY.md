# 数据库迁移安全与并发一致性（落地记录）

本文聚焦“数据库层面的修复与治理”：扩展依赖、迁移锁风险、并发一致性（去重）、以及在 SQLx 迁移体系下如何正确使用 `CONCURRENTLY` 与分阶段 DDL。

## 1. 迁移执行方式（SQLx）

- 迁移在启动时自动执行：后端启动流程会调用 `sqlx::migrate!("./migrations").run(&pool)`。
- SQLx 默认**每个 migration 在事务中执行**。
- PostgreSQL 的 `CREATE INDEX CONCURRENTLY` / `DROP INDEX CONCURRENTLY` **不能在事务块中运行**，因此需要在 migration 文件顶部添加：

```sql
-- no-transaction
```

并且建议让一个 migration 文件**只包含一条** `CONCURRENTLY` 语句（见第 3 节）。

## 2. 扩展依赖修复

### 2.1 `gen_random_uuid()` 依赖 `pgcrypto`

**问题**：`upload_sessions.id DEFAULT gen_random_uuid()` 依赖 `pgcrypto` 扩展；新环境或权限较严环境下可能在迁移阶段失败。

**修复**：显式启用扩展。

- 迁移文件： [024_enable_pgcrypto.sql](file:///Users/tyone/github/upload-download-util/backend/migrations/024_enable_pgcrypto.sql)
- 关键 SQL：

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

### 2.2 `pgvector` / `pg_stat_statements` 的权限说明（补充）

- `pgvector`：在 [018_add_semantic_search.sql](file:///Users/tyone/github/upload-download-util/backend/migrations/018_add_semantic_search.sql) 中启用 `CREATE EXTENSION IF NOT EXISTS vector;`
- `pg_stat_statements`：在 [020_enable_pg_stat_statements.sql](file:///Users/tyone/github/upload-download-util/backend/migrations/020_enable_pg_stat_statements.sql) 中启用（同时 compose 需要 preload）

生产/托管数据库经常限制 `CREATE EXTENSION` 权限：若应用用户无权限，迁移会失败并阻塞启动；此时应由 DBA 预先创建扩展或使用具备权限的账号执行迁移。

## 3. 大索引与“事务内 DDL”风险：CONCURRENTLY 路线

### 3.1 为什么需要 `CONCURRENTLY`

在大表上创建/重建索引：

- 非并发 `CREATE INDEX` 会阻塞写入（锁更重，持续更久）。
- `CREATE INDEX CONCURRENTLY` 允许并发写入，但执行更慢且无法在事务内运行。

因此本项目采用：

- **schema 变更（DDL）与并发索引拆分**
- **单语句 `-- no-transaction` migration**（避免 SQLx 事务块问题，同时降低排障复杂度）

### 3.2 向量索引（ivfflat）并发创建 / 旧索引并发删除

**背景**：`files.embedding` 的 ivfflat 索引属于“典型大索引”。原实现（018）在事务内 `CREATE INDEX IF NOT EXISTS ... USING ivfflat ...` 对大表不友好。

**修复策略**：保持 018 仍可用于新库快速建表；对线上/大库提供“并发重建”迁移路径：

- 并发创建新索引（新名字）：[032_create_idx_files_embedding_concurrently.sql](file:///Users/tyone/github/upload-download-util/backend/migrations/032_create_idx_files_embedding_concurrently.sql)
- 并发删除旧索引（回收空间）：[033_drop_idx_files_embedding.sql](file:///Users/tyone/github/upload-download-util/backend/migrations/033_drop_idx_files_embedding.sql)

关键点：

- “先建后删”避免出现无索引窗口期。
- 新索引使用不同名称，降低执行风险并便于回滚（可以先停在“只建不删”的阶段观察）。

### 3.3 background_tasks 索引并发迁移（维护友好）

同样采用“先建后删”的并发重建方式，拆分为多条单语句迁移：

- 去重唯一索引（先建）：[026_create_uq_background_tasks_active_dedupe_concurrently.sql](file:///Users/tyone/github/upload-download-util/backend/migrations/026_create_uq_background_tasks_active_dedupe_concurrently.sql)
- 去重唯一索引（后删旧）：[027_drop_uq_background_tasks_active_dedupe.sql](file:///Users/tyone/github/upload-download-util/backend/migrations/027_drop_uq_background_tasks_active_dedupe.sql)
- ready 索引（先建）：[028_create_idx_background_tasks_ready_concurrently.sql](file:///Users/tyone/github/upload-download-util/backend/migrations/028_create_idx_background_tasks_ready_concurrently.sql)
- ready 索引（后删旧）：[029_drop_idx_background_tasks_ready.sql](file:///Users/tyone/github/upload-download-util/backend/migrations/029_drop_idx_background_tasks_ready.sql)
- locked_until 索引（先建）：[030_create_idx_background_tasks_locked_until_concurrently.sql](file:///Users/tyone/github/upload-download-util/backend/migrations/030_create_idx_background_tasks_locked_until_concurrently.sql)
- locked_until 索引（后删旧）：[031_drop_idx_background_tasks_locked_until.sql](file:///Users/tyone/github/upload-download-util/backend/migrations/031_drop_idx_background_tasks_locked_until.sql)

## 4. 并发一致性修复：后台任务 dedupe（根治重复入队）

### 4.1 风险模型

“先查再插”（check-then-act）在并发下会被击穿，导致同一 `(task_type, dedupe_key)` 同时插入多条 `pending`。

### 4.2 数据库约束（唯一部分索引）

数据库侧通过唯一部分索引保证“活跃任务唯一”：

- 现有迁移： [025_background_tasks_active_dedupe_unique.sql](file:///Users/tyone/github/upload-download-util/backend/migrations/025_background_tasks_active_dedupe_unique.sql)
- 约束语义：当 `dedupe_key IS NOT NULL AND status IN ('pending','running')` 时，同一 `(task_type, dedupe_key)` 只能有 1 条。

### 4.3 代码侧原子入队（Upsert/Do Nothing）

代码层通过 `INSERT ... ON CONFLICT ... DO NOTHING RETURNING ...` 将并发窗口收敛为数据库原子操作，并在未插入时查询复用已有任务：

- 相关实现： [task_queue.rs](file:///Users/tyone/github/upload-download-util/backend/src/services/task_queue.rs#L182-L255)

关键点：

- **数据库唯一索引 + `ON CONFLICT` 推断**是根治并发重复入队的核心。
- 代码中的 “fallback 查询” 用于拿到已存在的任务返回给调用方（便于幂等）。

## 5. 已知高锁风险：历史迁移的处理策略（说明）

SQLx 迁移一旦在生产执行，不建议“回改历史 migration”（会造成 checksum 不一致与环境漂移）。因此对已存在的高风险写法，优先通过“新增 forward 迁移 + 运维流程”补强。

### 5.1 `ALTER TABLE ... ADD COLUMN ... NOT NULL DEFAULT NOW()` 风险（background_tasks）

- 现有迁移： [021_add_background_tasks_scheduling.sql](file:///Users/tyone/github/upload-download-util/backend/migrations/021_add_background_tasks_scheduling.sql)
- 风险点：`DEFAULT NOW()` 属于 volatile default，历史版本与多数场景下可能触发表回填/长时间锁；该表用于队列消费，锁表会阻塞 worker。

推荐做法（未来类似改动）：expand/contract 分阶段

1. 先加 nullable 列
2. 分批 backfill（避免长事务）
3. 再加 default
4. 最后再设 NOT NULL（短锁）

### 5.2 `files` 唯一约束与大表清理风险

- 现有迁移： [019_add_files_unique_constraint.sql](file:///Users/tyone/github/upload-download-util/backend/migrations/019_add_files_unique_constraint.sql)
- 说明：
  - 该迁移使用窗口函数清理重复并加约束，适合数据量较小或新库；若线上 `files` 超大，应把“清理重复”挪到运维脚本/一次性 Job 分批执行，再用在线索引方式落地约束。
  - `UNIQUE NULLS NOT DISTINCT` 依赖 PostgreSQL 15+；本项目开发环境为 Postgres 16（见 compose），因此兼容。

## 6. 测试环境：避免并发迁移导致 advisory lock 死锁

在测试并发执行时，多测试线程可能同时调用 `sqlx::migrate!().run()`，会在 SQLx 的迁移锁与事务边界上出现死锁/等待。

修复：在测试辅助函数中对迁移执行加进程内互斥，确保单进程内串行跑迁移：

- 实现： [tests/common/mod.rs](file:///Users/tyone/github/upload-download-util/backend/tests/common/mod.rs)

