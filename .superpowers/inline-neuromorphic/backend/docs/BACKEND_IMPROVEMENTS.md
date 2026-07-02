# 后端改进与优化清单

本文档列出当前后端可提升、可优化的实现点，按类别与优先级整理，便于按需排期。

---

## 一、配置与启动 ✅ 已完成

| 项目 | 现状 | 建议 | 优先级 |
|------|------|------|--------|
| **配置校验** | ~~仅必填项缺失时报错~~ | ✅ `Config::validate()`：端口 1..65535、MAX_FILE_SIZE>0、JWT_SECRET 非空、local 时 STORAGE_PATH 非空、维护任务间隔>0；PORT/HLS_THRESHOLD_BYTES 解析失败返回 `ConfigError` | 中 |
| **维护任务参数** | ~~写死在 main~~ | ✅ 已抽到 Config + 环境变量：`UPLOAD_SESSION_CLEANUP_*`、`FILES_CONSISTENCY_CHECK_*`、`ORPHAN_CLEANUP_*`，main 从 config 读取 | 低 |
| **RUST_LOG 默认** | 默认保持 | ✅ 在 main 中增加注释：生产建议 `RUST_LOG=info` | 低 |

---

## 二、错误处理与安全 ✅ 已完成

| 项目 | 现状 | 建议 | 优先级 |
|------|------|------|--------|
| **CatchPanicLayer** | ~~默认 panic 返回 500 空 body~~ | ✅ `CatchPanicLayer::custom(JsonPanicHandler)`：返回 JSON（message/code/error_id/timestamp），与 AppError 一致，不暴露 panic 内容 | 低 |
| **API Token HMAC** | ~~expect 可能 panic~~ | ✅ `hash_token` 改为 `Result<String, AppError>`，secret 为空或 `new_from_slice` 失败时返回 `AppError::Internal` | 中 |
| **Prometheus 初始化** | ~~expect 可能 panic~~ | ✅ `init_metrics()` 返回 `Result<..., BuildError>`，main 中 `.map_err(anyhow::...)` 统一处理 | 低 |
| **query token 安全** | ~~无限制~~ | ✅ 仅 **GET** 请求接受 `?token=xxx`；POST/PUT 等必须用 Authorization；文档注明勿在不可信环境把 token 放 URL | 中 |

---

## 三、性能与数据库 ✅ 批量删除已优化

| 项目 | 现状 | 建议 | 优先级 |
|------|------|------|--------|
| **批量删除 count_by_file_path** | ~~每路径一次查询~~ | ✅ 新增 `count_by_file_paths(paths: &[String]) -> HashMap<String, u64>`，单次 `WHERE file_path = ANY($1) GROUP BY file_path`；`batch_delete` 改为一次查后按 count==0 删存储 | 中 |
| **文件夹删除存储** | `folder::delete_folder` 中 `for path in &file_paths { storage.delete_file(path).await }` 串行 | 可限制并发（如 `futures::stream::iter` + `buffer_unordered(8)`）删存储，避免一次删上千文件时阻塞过久 | 低 |
| **连接池 statement_timeout** | 池级 `SET statement_timeout = '20s'`，list 已用 `SET LOCAL 3s` | 保持；若有其他长耗时查询（如复杂报表），可单独开连接或 `SET LOCAL` 放大超时 | - |
| **list 总条数** | ✅ 已支持 `include_total=false` 跳过 `COUNT(*) OVER()`；游标分页天然不算 total | 默认优先游标分页；传统分页仅在需要 total 时开启 include_total | 低 |
| **DB 并发一致性** | 高并发上传时可能出现重复文件名记录 | ✅ 通过数据库唯一约束修复：`UNIQUE NULLS NOT DISTINCT (user_id, folder_id, original_filename)`，并在迁移中清理历史重复 | 中 |
| **查询可观测性** | 缺少慢 SQL 统计 | ✅ 启用 `pg_stat_statements`（docker-compose preload + 迁移创建扩展） | 中 |

---

## 四、代码质量与可维护性 ✅ 已完成

| 项目 | 现状 | 建议 | 优先级 |
|------|------|------|--------|
| **重复路由** | ~~两套 nest 重复挂载~~ | ✅ 抽成 `api::create_api_routes()`，main 中 `.nest("/api/v1", api::create_api_routes()).nest("/api", api::create_api_routes())` 复用 | 低 |
| **FileService 注入 AppState** | ~~每次 handler 内 `FileService::from_state(&state)`~~ | ✅ `AppState` 持有一份 `Arc<FileService>`，启动时在 `AppState::new` 中构造一次；handlers 统一使用 `state.file_service`，`FileService::from_state` 保留供测试/临时构造 | 低 |
| **bin/check_file_owners** | ~~unwrap()~~ | ✅ `Uuid::parse_str` 改为 `.map_err(anyhow::anyhow!(...))?`，无效输入时返回明确错误 | 低 |
| **常量与配置** | ~~分散在 constants 与 config~~ | ✅ 见 [CONFIG_AND_LIMITS.md](./CONFIG_AND_LIMITS.md)：请求体/业务上限与配置项、常量对应关系 | 低 |

---

## 五、可观测与运维

| 项目 | 现状 | 建议 | 优先级 |
|------|------|------|--------|
| **请求日志** | ~~仅 method/path/status/elapsed_ms~~ | ✅ request_id：从 `X-Request-ID` 读取或生成 8 位，打入 `tracing::info_span!("request", request_id)`，整请求 span 生效；响应头回写 `X-Request-ID`，便于与 error_id 关联 | 中 |
| **健康检查** | `/health` 检查 DB + 存储，返回 503 时 body 含 checks | 保持；若有依赖（如 Redis）可扩展 checks；考虑加 `/health/ready` 与 `/health/live` 语义区分（当前 /readyz 与 /health 相同） | 低 |
| **后台任务监控** | 维护任务仅打 log，失败后下一轮继续 | 可对「连续失败次数」打 metric 或告警；或暴露 `orphan_cleanup_last_run_timestamp` 等，便于监控 | 低 |
| **速率限制** | ✅ Redis 可用时使用 Redis 计数（多实例一致）；未配置 Redis 时回退 moka（单实例） | 保持分片上传路径豁免；敏感路径可单独更严（如登录/验证码发送） | 中 |

---

## 六、测试与 CI

| 项目 | 现状 | 建议 | 优先级 |
|------|------|------|--------|
| **集成测试** | 有 `repository_tests`、`auth_tests` 等 | 增加 list/files 核心接口的集成测试（含分页、筛选、空列表）；考虑用 `sqlx::test` 或 testcontainers 统一 DB 环境 | 中 |
| **编译时 SQL 检查** | 当前多为 `query_as` 运行时检查 | 对稳定 SQL 可逐步引入 `sqlx::query!` 做编译时检查（需 `SQLX_OFFLINE=true` 或 DB 可用） | 低 |

---

## 七、已做或可快速落地的项 ✅ 已全部落地

以下为本清单中已完成的改进汇总：

- **配置与启动（一）**：Config 启动校验（端口、MAX_FILE_SIZE、JWT、local 存储路径、维护间隔）；维护任务参数抽到 Config/环境变量；RUST_LOG 生产建议注释。
- **错误与安全（二）**：CatchPanicLayer 自定义 JSON 响应；API Token HMAC 去掉 expect、校验 secret；Prometheus init 返回 Result；query token 仅 GET 接受并加文档。
- **性能与数据库（三）**：`count_by_file_paths` 批量查引用数，batch_delete 一次查后删存储；files 仓库此前已有空 ids 防护、get_storage_usage 用 fetch_one、list_by_folder 单条 SQL、013 迁移索引。
- **数据库与可观测（补充）**：并发上传一致性约束（019 迁移清理 + UNIQUE）；启用 `pg_stat_statements`（020 迁移 + compose preload）。
- **分页性能（补充）**：文件列表支持 `include_total=false` 跳过 total 计算，配合游标分页降低大表延迟。
- **代码质量与可维护性（四）**：API 路由抽成 `api::create_api_routes()` 复用；**FileService 注入 AppState**（`AppState` 持有一份 `Arc<FileService>`，handlers 使用 `state.file_service`，不再在每次请求内 `from_state`）；bin/check_file_owners 去掉 unwrap；[CONFIG_AND_LIMITS.md](./CONFIG_AND_LIMITS.md) 列清常量与配置对应关系。
- **可观测与运维（五·请求日志）**：request_id（X-Request-ID 或生成）打入 tracing span，响应头回写，便于与 error_id 关联。
- **Redis（补充）**：接入 Redis 连接池（可选），用于验证码/OAuth state、限流、多实例共享缓存、分布式锁（缩略图与 HLS 生成），并为高频读接口引入“版本号失效”策略避免 SCAN。
- **孤儿清理**：批量 find_by_ids、每轮 info 日志；可选按负载调 ORPHAN_DB_BATCH_SIZE。
- **GIF 预览异步转码与任务队列**：引入 `background_tasks` 表与 `TaskQueue` 服务，用 `enqueue_task/dequeue_pending_task` 管理 GIF 预览转码任务；`FileService::transcode_gif_to_mp4` 封装 GIF→mp4 转码逻辑，`run_gif_preview_worker` 后台 Worker 以 FOR UPDATE SKIP LOCKED 方式并行消费；`/api/files/:id/preview/video/prepare` 与 `/status` 接口改为基于任务队列与派生文件是否存在返回 `ready/processing` 状态，`/preview/video` 仅在派生 mp4 已存在时流式返回视频。

---

## 建议实施顺序（剩余可选）

上述高优先级项均已完成。后续可按需排期：

1. **可观测**：健康检查语义区分（/health/ready 与 /live）；后台任务连续失败 metric 或告警。
2. **性能**：文件夹删除存储时限制并发；list 总数改为单独 COUNT 或缓存（需权衡一致性）。
3. **测试与 CI**：list/files 核心接口集成测试；sqlx::query! 编译时 SQL 检查。
4. **其它**：按 user_id 或敏感路径的速率限制；其它风格优化（FileService 注入 AppState 已完成）。

如需对某一项做具体方案或补丁，可以指定编号或类别继续细化。
