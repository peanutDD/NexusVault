# 顶级视频平台技术对标（落地映射表）

面向开发/运维：把“顶级视频平台常见技术点”映射到本项目的**具体模块、接口、开关与现状**，并且保留“未落地项清单”（只是不在代码里做承诺）。

标记：✅ 已落地 / 🟡 部分落地（有约束）/ ⏳ 未落地（预留方向）

---

## 0) 快速索引（从代码跳转）

- 下载/预览（Range + 条件请求）：[download/mod.rs](file:///Users/tyone/github/upload-download-util/backend/src/handlers/files/download/mod.rs)
- 存储后端（local/S3 + presign）：[storage.rs](file:///Users/tyone/github/upload-download-util/backend/src/services/storage.rs)
- 文件列表（offset + cursor/keyset）：[files.rs(list)](file:///Users/tyone/github/upload-download-util/backend/src/repositories/files.rs)
- 批量 ZIP（流式 + Range + 缓存）：[batch.rs](file:///Users/tyone/github/upload-download-util/backend/src/handlers/files/batch.rs) / [batch_zip.rs](file:///Users/tyone/github/upload-download-util/backend/src/services/file/batch_zip.rs)
- Worker（任务消费）：[worker.rs](file:///Users/tyone/github/upload-download-util/backend/src/bin/worker.rs)
- Postgres 队列（lease/backoff/requeue）：[task_queue.rs](file:///Users/tyone/github/upload-download-util/backend/src/services/task_queue.rs)
- HLS（大视频预览 + ABR 多码率）：[hls.rs](file:///Users/tyone/github/upload-download-util/backend/src/services/file/hls.rs)
- Redis 缓存/锁自检入口：[API_AND_CACHING_SELF_CHECK.md](file:///Users/tyone/github/upload-download-util/backend/docs/API_AND_CACHING_SELF_CHECK.md)
- 配置项与业务上限：[CONFIG_AND_LIMITS.md](file:///Users/tyone/github/upload-download-util/backend/docs/CONFIG_AND_LIMITS.md)
- 全局开关矩阵（本地/云端接口边界）：[开关矩阵与接口边界.md](file:///Users/tyone/github/upload-download-util/docs/开关矩阵与接口边界.md)

---

## 1) 已落地/可验证能力（对标项 → 本项目实现）

| 对标项 | 状态 | 本地验证（接口/行为） | 开关/配置 | 代码入口 |
| --- | --- | --- | --- | --- |
| 下载/预览 Range（单段/多段） | ✅ | `GET/HEAD /api/files/:id/download` / `GET/HEAD /api/files/:id/preview` | 无（协议能力） | [download/mod.rs](file:///Users/tyone/github/upload-download-util/backend/src/handlers/files/download/mod.rs) |
| 条件请求（ETag/If-* / 304 / 412） | ✅ | 同上；If-None-Match/If-Range 等 | 无（协议能力） | [download/mod.rs](file:///Users/tyone/github/upload-download-util/backend/src/handlers/files/download/mod.rs) |
| 下载模式（API 代理 vs 302 presign） | 🟡 | `DOWNLOAD_MODE=proxy` 走代理；`redirect/presigned` 302 | `DOWNLOAD_MODE` / `PRESIGN_TTL_SECS` | [storage.rs](file:///Users/tyone/github/upload-download-util/backend/src/services/storage.rs) / [download/mod.rs](file:///Users/tyone/github/upload-download-util/backend/src/handlers/files/download/mod.rs) |
| 批量 ZIP（流式 + Range） | ✅ | `POST /api/files/download-zip`；大包首包更快 | 无（默认启用） | [batch.rs](file:///Users/tyone/github/upload-download-util/backend/src/handlers/files/batch.rs) |
| 批量 ZIP 产物缓存复用 | ✅ | 开启后命中复用 + Range | `ZIP_CACHE_ENABLED` / `ZIP_CACHE_TTL_SECS` | [batch_zip.rs](file:///Users/tyone/github/upload-download-util/backend/src/services/file/batch_zip.rs) |
| 批量 ZIP 并发隔离 | ✅ | 多并发下载不拖垮 API | `ZIP_BUILD_MAX_CONCURRENT` | [state.rs](file:///Users/tyone/github/upload-download-util/backend/src/state.rs) / [batch.rs](file:///Users/tyone/github/upload-download-util/backend/src/handlers/files/batch.rs) |
| 文件列表分页（offset + cursor/keyset） | ✅ | `GET /api/files?cursor=...` 或 `pagination=cursor` | 无（由 query 决定） | [files.rs(list)](file:///Users/tyone/github/upload-download-util/backend/src/repositories/files.rs) |
| Redis 分布式锁（缩略图/HLS） | ✅ | Redis 可用时防击穿；不可用自动降级 | `REDIS_URL`（可选） | [download/mod.rs](file:///Users/tyone/github/upload-download-util/backend/src/handlers/files/download/mod.rs) |
| Redis cache-aside（列表/分类/用量） | ✅ | 缓存成功响应；失败回源 | `CACHE_ENABLED` / `LIST_CACHE_TTL_SECS` 等 | [API_AND_CACHING_SELF_CHECK.md](file:///Users/tyone/github/upload-download-util/backend/docs/API_AND_CACHING_SELF_CHECK.md) |
| Worker 转码任务（gif_preview） | ✅ | prepare/status + worker 消费 | `WORKER_CONCURRENCY` | [worker.rs](file:///Users/tyone/github/upload-download-util/backend/src/bin/worker.rs) / [task_queue.rs](file:///Users/tyone/github/upload-download-util/backend/src/services/task_queue.rs) |
| 转码并发配额（全局 + task_type） | ✅ | 限制 CPU/IO，避免互相影响 | `TRANSCODE_MAX_CONCURRENT` / `TASK_TYPE_CONCURRENCY_*` | [worker.rs](file:///Users/tyone/github/upload-download-util/backend/src/bin/worker.rs) |
| HLS 大视频预览（prepare/status/playlist/assets） | ✅ | `POST /api/files/:id/hls/prepare` + `GET /api/files/:id/hls` | `HLS_THRESHOLD_BYTES` | [download/mod.rs](file:///Users/tyone/github/upload-download-util/backend/src/handlers/files/download/mod.rs) / [hls.rs](file:///Users/tyone/github/upload-download-util/backend/src/services/file/hls.rs) |
| ABR 多码率（逐档位放开） | ✅ | `HLS_ABR_MAX_VARIANTS>1` 生成 `master.m3u8` + variants | `HLS_ABR_MAX_VARIANTS` / `HLS_ABR_VARIANTS` | [hls.rs](file:///Users/tyone/github/upload-download-util/backend/src/services/file/hls.rs) |
| Postgres 队列（lease/backoff/requeue/metrics） | ✅ | 多实例竞争消费 + 卡死回收 | `TASK_QUEUE_BACKEND=postgres` | [task_queue.rs](file:///Users/tyone/github/upload-download-util/backend/src/services/task_queue.rs) |
| 读写分离（可选读库） | ✅ | 配了 `READ_REPLICA_DATABASE_URL` 读走 replica | `READ_REPLICA_DATABASE_URL`（可选） | [main.rs](file:///Users/tyone/github/upload-download-util/backend/src/main.rs) / [state.rs](file:///Users/tyone/github/upload-download-util/backend/src/state.rs) |

---

## 2) 已知约束（为什么是 🟡）

| 能力 | 当前约束 | 如何变成 “云端可卸载/可扩容” |
| --- | --- | --- |
| `DOWNLOAD_MODE=redirect/presigned` | 仅 `STORAGE_BACKEND=s3` 支持（配置校验会拒绝其他组合） | 上 S3 + CDN；download/preview 走 302 或 CDN 域名 |
| HLS/ABR | 当前仅 `local` 存储支持转码 | S3 场景先落临时文件再转码，或用云转码服务；产物上传对象存储 |
| `TASK_QUEUE_BACKEND` | 当前仅 `postgres` 支持（为未来 provider 预留） | 增加 Redis/Kafka/SQS provider 实现并放开校验 |

---

## 3) 通用架构知识点（对标项保留，不删）

这一节不是“实现清单”，而是把顶级平台常见的架构知识点按主题梳理出来，并标注本项目**能复用的落地点**（即便当前不需要，也不应该从文档里删掉）。

### 3.1 微服务 + 无状态设计

- 是什么：把系统拆成多个服务（API/worker/媒体处理/推荐等），每个服务尽量无状态，状态放 DB/缓存/对象存储。
- 为什么：无状态服务更易水平扩容、更易灰度/滚动发布；服务边界清晰也利于隔离故障域。
- 怎么做（常见做法）：
  - 请求入口：LB（Nginx/Envoy）→ API（无状态）→ DB/缓存/对象存储
  - 异步任务：队列 → worker 集群
  - 状态：session/token/短期状态放 Redis；文件体放对象存储；元数据放 DB
- 本项目映射：
  - ✅ API 与 worker 已拆进程（二进制）：[main.rs](file:///Users/tyone/github/upload-download-util/backend/src/main.rs) / [worker.rs](file:///Users/tyone/github/upload-download-util/backend/src/bin/worker.rs)
  - ✅ 业务长任务已走队列/worker（gif_preview）：[task_queue.rs](file:///Users/tyone/github/upload-download-util/backend/src/services/task_queue.rs)
  - 🟡 HLS 当前由 API 触发后台任务（非队列化）：[download/mod.rs](file:///Users/tyone/github/upload-download-util/backend/src/handlers/files/download/mod.rs)
  - ⏳ 进一步服务化：把 HLS/ABR 也改成入队任务（同一个 TaskQueueProvider 边界即可）

### 3.2 限流与抗压机制

- 是什么：在系统过载时限制请求速率、保护关键路径，避免雪崩（包括限流/排队/降级/熔断/隔离）。
- 为什么：高并发系统失败往往来自“资源被耗尽后级联失败”，抗压优先级高于“多跑一点业务逻辑”。
- 怎么做（常见做法）：
  - 多维度限流：IP、用户、路由、写操作、后台任务
  - 隔离资源池：转码/打包等重活单独配额或单独 worker
  - 失败策略：可重试错误 + backoff；不可用依赖 fail-open 或快速失败
- 本项目映射：
  - ✅ API 层限流（Redis 可用时多实例一致）：[rate_limit.rs](file:///Users/tyone/github/upload-download-util/backend/src/middleware/rate_limit.rs)
  - ✅ 转码并发配额（全局 + task_type）：[worker.rs](file:///Users/tyone/github/upload-download-util/backend/src/bin/worker.rs)
  - ✅ ZIP 打包并发隔离：`ZIP_BUILD_MAX_CONCURRENT`，[batch.rs](file:///Users/tyone/github/upload-download-util/backend/src/handlers/files/batch.rs)
  - ✅ HLS/缩略图防击穿锁：Redis lock（见自检文档），[API_AND_CACHING_SELF_CHECK.md](file:///Users/tyone/github/upload-download-util/backend/docs/API_AND_CACHING_SELF_CHECK.md)

### 3.3 缓存体系（多层缓存）

- 是什么：把“读多写少”的热点从 DB 卸载出去（浏览器/边缘/CDN/Redis/进程内缓存/磁盘缓存）。
- 为什么：顶级平台的高并发本质是“命中率问题”；缓存比分库分表更早、更有效。
- 怎么做（常见做法）：
  - HTTP 条件缓存（ETag/Last-Modified/304）+ Range（断点续传）
  - Redis cache-aside（只缓存成功响应，TTL + 版本号失效）
  - 磁盘缓存（派生资源：缩略图、HLS、ZIP 产物）
  - CDN：对象存储回源 + 长 TTL + 带签名
- 本项目映射：
  - ✅ 下载/预览的条件请求 + Range： [download/mod.rs](file:///Users/tyone/github/upload-download-util/backend/src/handlers/files/download/mod.rs)
  - ✅ Redis cache-aside + 锁： [API_AND_CACHING_SELF_CHECK.md](file:///Users/tyone/github/upload-download-util/backend/docs/API_AND_CACHING_SELF_CHECK.md)
  - ✅ 磁盘缓存：缩略图 `.thumbnails`、HLS `.hls`、ZIP 缓存（可选）：[CONFIG_AND_LIMITS.md](file:///Users/tyone/github/upload-download-util/backend/docs/CONFIG_AND_LIMITS.md)
  - ⏳ CDN/边缘缓存：通过 `DOWNLOAD_MODE=presigned/redirect` 作为卸载入口对接

### 3.4 读写分离与数据扩展

- 是什么：把读流量从主库卸载到只读副本；极端规模下才考虑分片/分库分表。
- 为什么：大多数场景“读写分离 + 缓存”就能覆盖数量级增长；过早分片会让复杂度飙升。
- 怎么做（常见做法）：
  - primary/replica：读走 replica，写走 primary
  - 一致性：对强一致读走 primary；其余走 replica 允许秒级延迟
  - 分片：按 user_id 或 content_id 做路由（通常最后一步）
- 本项目映射：
  - ✅ 可选读库：`READ_REPLICA_DATABASE_URL`，[main.rs](file:///Users/tyone/github/upload-download-util/backend/src/main.rs) / [state.rs](file:///Users/tyone/github/upload-download-util/backend/src/state.rs)
  - ⏳ 分片/分库分表：保留为路线图项（本仓库目前不需要）

### 3.5 可观测性（Metrics/Logging）

- 是什么：让你在“高并发 + 多实例”情况下仍能回答：哪里慢、哪里错、是否过载、队列堆积多少。
- 为什么：没有可观测性，开关/扩容/降级都是盲飞。
- 怎么做（常见做法）：
  - 关键指标：RPS、P95/P99、错误率、队列深度、转码耗时、缓存命中率
  - 结构化日志：带 request_id/task_id/user_id/file_id
- 本项目映射：
  - ✅ Prometheus metrics 与路径简化： [middleware/metrics](file:///Users/tyone/github/upload-download-util/backend/src/middleware/metrics.rs)
  - ✅ 转码相关指标（gif_preview）：[task_queue.rs](file:///Users/tyone/github/upload-download-util/backend/src/services/task_queue.rs)
  - 🟡 队列深度→自动弹性伸缩：已具备指标，是否接 HPA/KEDA 属于部署侧

---

## 4) 未落地清单（对标项保留，不删）

这些项在顶级平台常见，但当前仓库不实现或只做了边界预留。保留在这里方便你做路线图/拆任务。

### 4.1 流媒体/播放器工程

| 对标项 | 状态 | 备注（落地策略建议） |
| --- | --- | --- |
| MPEG-DASH | ⏳ | 与 HLS 类似，需要独立 packager 与 manifest/segment 路由 |
| CMAF/fMP4 分片（替代 TS） | ⏳ | 更利于低延迟与跨协议；需要改 ffmpeg 参数与 asset mime/缓存策略 |
| DRM（Widevine/FairPlay/PlayReady） | ⏳ | 本项目若涉及付费/受限内容才需要；会引入 license server 与密钥管理 |
| 字幕/多音轨 | ⏳ | 需要存储字幕文件与在 manifest 引用；前端播放器也需适配 |
| QoE 指标（卡顿率/首帧/码率切换） | ⏳ | 可在前端上报 + 后端聚合；HLS/ABR 更需要可观测性 |

### 4.2 分发/CDN

| 对标项 | 状态 | 备注（落地策略建议） |
| --- | --- | --- |
| CDN 多层缓存（edge + regional + origin） | ⏳ | 当前以 HTTP 缓存头 + presign/redirect 为卸载入口；云端接入 CDN 即可发挥 |
| 多 CDN 供应商切换（容灾/成本） | ⏳ | 需要 DNS/调度层；本项目只需保证对象存储与 URL 生成策略可替换 |
| Signed Cookie / Tokenized URL | ⏳ | 若不想用短 TTL presign，可改为 CDN 鉴权；需要新 provider 与 token 校验 |

### 4.3 存储与生命周期

| 对标项 | 状态 | 备注（落地策略建议） |
| --- | --- | --- |
| 对象存储生命周期（热/温/冷分层） | ⏳ | 对接 S3 lifecycle 或同类能力；本地无需 |
| 跨区域复制/多活 | ⏳ | 需要更强的一致性与元数据复制策略；本项目先不做 |

### 4.4 转码基础设施

| 对标项 | 状态 | 备注（落地策略建议） |
| --- | --- | --- |
| GPU 编码（NVENC） | ⏳ | 云端 worker 直接替换 ffmpeg 编码参数即可；仍保留并发配额 |
| HLS/ABR 进队列异步化 | ⏳ | 目前 HLS 由 API 触发 `tokio::spawn`；可改为入队任务（更可控） |
| 转码产物落对象存储 | ⏳ | 把 `.hls` 产物上传到 S3，并让 `/hls/*` 走 `DOWNLOAD_MODE=presigned` 或 CDN |

### 4.5 数据与业务（非核心但常见）

| 对标项 | 状态 | 备注（落地策略建议） |
| --- | --- | --- |
| 数据库分片/分库分表 | ⏳ | 当前读写分离已足够；分片只在数据量/写入量上来后再做 |
| 推荐系统/行为日志流 | ⏳ | 不属于“上传下载工具”的必需能力；若要做可单独服务化，不建议耦合进本仓库 |
