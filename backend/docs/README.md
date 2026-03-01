## 后端文档总览

本目录下是后端（Rust + Axum）相关的设计与落地文档，按主题分组如下。

### 架构与性能

- `TOP_TECH.md`：顶级视频平台技术对标表（知识点 → 本项目实现/开关/未落地清单）
- `BACKEND_IMPROVEMENTS.md`：后端改进建议与已完成项
- `OPTIMIZATION_SUMMARY.md`（在 `backend/` 根目录）：后端性能优化总结，配合本目录文档一起看

### 配置与运行时

- `CONFIG_AND_LIMITS.md`：环境变量、业务上限与常量映射表（运维调参入口）
- `.env.example`（在 `backend/` 根目录）：完整示例配置文件

### API 与数据访问

- `UPLOAD_API.md`：上传相关 API 行为说明（普通上传、分片上传、断点续传）
- `API_AND_CACHING_SELF_CHECK.md`：API 协议与缓存落地自检（分页、条件请求、Redis 使用点等）
- `POSTGRES_OPTIMIZATION.md`：与 SQLx/Postgres 相关的优化说明（包括分页查询、索引等）
- `DB_MIGRATION_SAFETY.md`：迁移安全与并发一致性（扩展依赖、CONCURRENTLY、任务去重等）

### 重构与代码质量

- `IMPROVEMENTS.md`：历史/未来 refactor 与清理任务记录
- `REFACTORING.md`：后端重构方向与约定（与根目录的代码审查文档配合使用）

> 提示：如果你在排查具体问题，可以从 `CONFIG_AND_LIMITS.md` 和 `API_AND_CACHING_SELF_CHECK.md` 入手；如果你在做“能力对标”或规划高并发路线，可以从 `TOP_TECH.md` 与根目录的 `docs/开关矩阵与接口边界.md` 开始阅读。
