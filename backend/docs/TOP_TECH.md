# 顶级视频平台技术对标（落地映射表）

面向开发/运维：把"顶级视频平台常见技术点"映射到本项目的**具体模块、接口、开关与现状**，并且保留"未落地项清单"（只是不在代码里做承诺）。

标记：✅ 已落地 / 🟡 部分落地（有约束）/ ⏳ 未落地（预留方向）

---

## 0) 快速索引（从代码跳转）

**核心下载/上传/存储**
- 下载/预览（Range + 条件请求）：[download/mod.rs](file:///Users/tyone/github/upload-download-util/backend/src/handlers/files/download/mod.rs)
- 普通上传：[upload.rs](file:///Users/tyone/github/upload-download-util/backend/src/handlers/files/upload.rs)
- 分块可恢复上传（init/chunk/status/complete/abort）：[chunked_upload.rs](file:///Users/tyone/github/upload-download-util/backend/src/handlers/files/chunked_upload.rs) / [file/chunked_upload.rs](file:///Users/tyone/github/upload-download-util/backend/src/services/file/chunked_upload.rs)
- 秒传（SHA-256 文件指纹去重）：[instant_upload.rs](file:///Users/tyone/github/upload-download-util/backend/src/handlers/files/instant_upload.rs) / [file/instant_upload.rs](file:///Users/tyone/github/upload-download-util/backend/src/services/file/instant_upload.rs)
- 存储后端（local/S3 + presign）：[storage.rs](file:///Users/tyone/github/upload-download-util/backend/src/services/storage.rs)
- 批量 ZIP（流式 + Range + 缓存）：[batch.rs](file:///Users/tyone/github/upload-download-util/backend/src/handlers/files/batch.rs) / [batch_zip.rs](file:///Users/tyone/github/upload-download-util/backend/src/services/file/batch_zip.rs)

**媒体处理**
- GIF → MP4 懒转码预览（prepare/status/stream）：[video.rs](file:///Users/tyone/github/upload-download-util/backend/src/handlers/files/video.rs)
- HLS（大视频预览 + ABR 多码率）：[hls.rs](file:///Users/tyone/github/upload-download-util/backend/src/services/file/hls.rs)
- Worker（任务消费）：[worker.rs](file:///Users/tyone/github/upload-download-util/backend/src/bin/worker.rs)
- Postgres 队列（lease/backoff/requeue）：[task_queue.rs](file:///Users/tyone/github/upload-download-util/backend/src/services/task_queue.rs)

**搜索与 AI**
- 语义搜索（Hugging Face Inference API + pgvector）：[semantic_search.rs handler](file:///Users/tyone/github/upload-download-util/backend/src/handlers/files/semantic_search.rs) / [file/semantic_search.rs](file:///Users/tyone/github/upload-download-util/backend/src/services/file/semantic_search.rs)
- 向量嵌入服务（all-MiniLM-L6-v2）：[embeddings.rs](file:///Users/tyone/github/upload-download-util/backend/src/services/embeddings.rs)
- 文件内容提取（PDF/DOCX/HTML/TXT 等）：[file_content_extractor.rs](file:///Users/tyone/github/upload-download-util/backend/src/services/file_content_extractor.rs)

**组织、分享与协作**
- 文件分享链接（password/expiry/max_downloads/批量）：[share.rs handler](file:///Users/tyone/github/upload-download-util/backend/src/handlers/share.rs) / [share.rs service](file:///Users/tyone/github/upload-download-util/backend/src/services/share.rs)
- 组织与多租户（RBAC: owner/admin/member）：[organization.rs](file:///Users/tyone/github/upload-download-util/backend/src/services/organization.rs)
- 文件夹层级管理（CRUD + 移动 + 面包屑）：[folders.rs handler](file:///Users/tyone/github/upload-download-util/backend/src/handlers/folders.rs) / [folder.rs service](file:///Users/tyone/github/upload-download-util/backend/src/services/folder.rs)
- 文件版本管理（list/get/restore/label/delete）：[versions.rs handler](file:///Users/tyone/github/upload-download-util/backend/src/handlers/files/versions.rs) / [file/versions.rs](file:///Users/tyone/github/upload-download-util/backend/src/services/file/versions.rs)

**认证与安全**
- OAuth 第三方登录（GitHub + Google）：[oauth_github.rs](file:///Users/tyone/github/upload-download-util/backend/src/api/oauth_github.rs) / [oauth_google.rs](file:///Users/tyone/github/upload-download-util/backend/src/api/oauth_google.rs)
- API Token 认证：[api_token.rs handler](file:///Users/tyone/github/upload-download-util/backend/src/handlers/api_token.rs)
- 限流与 Retry-After：[rate_limit.rs](file:///Users/tyone/github/upload-download-util/backend/src/middleware/rate_limit.rs)
- 图片代理（SSRF 防护）：[proxy.rs](file:///Users/tyone/github/upload-download-util/backend/src/api/proxy.rs)

**可观测性与运维**
- Redis 缓存/锁自检入口：[API_AND_CACHING_SELF_CHECK.md](file:///Users/tyone/github/upload-download-util/backend/docs/API_AND_CACHING_SELF_CHECK.md)
- Prometheus metrics：[middleware/metrics.rs](file:///Users/tyone/github/upload-download-util/backend/src/middleware/metrics.rs)
- 前端遥测上报：[telemetry.rs](file:///Users/tyone/github/upload-download-util/backend/src/api/telemetry.rs)
- 维护后台任务（ZIP/会话/一致性/孤儿清理）：[maintenance.rs](file:///Users/tyone/github/upload-download-util/backend/src/services/maintenance.rs)
- Admin 后台任务管理（list/retry）：[admin.rs](file:///Users/tyone/github/upload-download-util/backend/src/handlers/admin.rs)
- 配置项与业务上限：[CONFIG_AND_LIMITS.md](file:///Users/tyone/github/upload-download-util/backend/docs/CONFIG_AND_LIMITS.md)
- 全局开关矩阵（本地/云端接口边界）：[开关矩阵与接口边界.md](file:///Users/tyone/github/upload-download-util/docs/开关矩阵与接口边界.md)
- OpenAPI 规范：[openapi.rs](file:///Users/tyone/github/upload-download-util/backend/src/api/openapi.rs)

---

## 1) 已落地/可验证能力（对标项 → 本项目实现）

### 1.1 下载与存储

| 对标项 | 状态 | 本地验证（接口/行为） | 开关/配置 | 代码入口 |
| --- | --- | --- | --- | --- |
| 下载/预览 Range（单段/多段） | ✅ | `GET/HEAD /api/files/:id/download` / `GET/HEAD /api/files/:id/preview` | 无（协议能力） | [download/mod.rs](file:///Users/tyone/github/upload-download-util/backend/src/handlers/files/download/mod.rs) |
| 条件请求（ETag/If-* / 304 / 412） | ✅ | 同上；If-None-Match/If-Range 等 | 无（协议能力） | [download/mod.rs](file:///Users/tyone/github/upload-download-util/backend/src/handlers/files/download/mod.rs) |
| 下载模式（API 代理 vs 302 presign） | 🟡 | `DOWNLOAD_MODE=proxy` 走代理；`redirect/presigned` 302 | `DOWNLOAD_MODE` / `PRESIGN_TTL_SECS` | [storage.rs](file:///Users/tyone/github/upload-download-util/backend/src/services/storage.rs) / [download/mod.rs](file:///Users/tyone/github/upload-download-util/backend/src/handlers/files/download/mod.rs) |
| 普通文件上传 | ✅ | `POST /api/files/upload`；限并发 + 请求体大小 | `MAX_FILE_SIZE` / `UPLOAD_CONCURRENCY` | [upload.rs](file:///Users/tyone/github/upload-download-util/backend/src/handlers/files/upload.rs) |
| 秒传（SHA-256 文件指纹去重） | ✅ | `POST /api/files/upload/instant`；已有相同内容则 201 复用，无则 200 `instant:false` | 无（功能开关由客户端决定是否尝试） | [instant_upload.rs](file:///Users/tyone/github/upload-download-util/backend/src/handlers/files/instant_upload.rs) |
| 分块可恢复上传 | ✅ | Init→Chunk→Status→Complete/Abort；`X-Part-SHA256` 分块完整性校验；断点续传可恢复 | `MAX_CONCURRENT_CHUNKED_UPLOADS` | [chunked_upload.rs](file:///Users/tyone/github/upload-download-util/backend/src/handlers/files/chunked_upload.rs) |
| 批量 ZIP（流式 + Range） | ✅ | `POST /api/files/download-zip`；大包首包更快 | 无（默认启用） | [batch.rs](file:///Users/tyone/github/upload-download-util/backend/src/handlers/files/batch.rs) |
| 批量 ZIP 产物缓存复用 | ✅ | 开启后命中复用 + Range | `ZIP_CACHE_ENABLED` / `ZIP_CACHE_TTL_SECS` | [batch_zip.rs](file:///Users/tyone/github/upload-download-util/backend/src/services/file/batch_zip.rs) |
| 批量 ZIP 并发隔离 | ✅ | 多并发下载不拖垮 API | `ZIP_BUILD_MAX_CONCURRENT` | [state.rs](file:///Users/tyone/github/upload-download-util/backend/src/state.rs) / [batch.rs](file:///Users/tyone/github/upload-download-util/backend/src/handlers/files/batch.rs) |
| 文件列表分页（offset + cursor/keyset） | ✅ | `GET /api/files?cursor=...` 或 `pagination=cursor` | 无（由 query 决定） | [files.rs(list)](file:///Users/tyone/github/upload-download-util/backend/src/repositories/files.rs) |
| 存储配额管理 | ✅ | `GET /api/files/storage-usage` 返回已用量与上限 | `users.storage_quota_bytes` | [file/quota.rs](file:///Users/tyone/github/upload-download-util/backend/src/services/file/quota.rs) |

### 1.2 媒体处理与转码

| 对标项 | 状态 | 本地验证（接口/行为） | 开关/配置 | 代码入口 |
| --- | --- | --- | --- | --- |
| HLS 大视频预览（prepare/status/playlist/assets） | ✅ | `POST /api/files/:id/hls/prepare` 排队转码；`GET /api/files/:id/hls` 服务产物 | `HLS_THRESHOLD_BYTES` | [download/mod.rs](file:///Users/tyone/github/upload-download-util/backend/src/handlers/files/download/mod.rs) / [hls.rs](file:///Users/tyone/github/upload-download-util/backend/src/services/file/hls.rs) |
| HLS/ABR 进队列异步化（进程重启可恢复） | ✅ | prepare → enqueue_task；worker 消费；status 可感知 FFmpeg 失败 | `TASK_TYPE_CONCURRENCY_hls_preview`（可选） | [task_queue.rs](file:///Users/tyone/github/upload-download-util/backend/src/services/task_queue.rs) / [worker.rs](file:///Users/tyone/github/upload-download-util/backend/src/bin/worker.rs) |
| ABR 多码率（逐档位放开） | ✅ | `HLS_ABR_MAX_VARIANTS>1` 生成 `master.m3u8` + variants | `HLS_ABR_MAX_VARIANTS` / `HLS_ABR_VARIANTS` | [hls.rs](file:///Users/tyone/github/upload-download-util/backend/src/services/file/hls.rs) |
| GIF → MP4 懒转码预览 | ✅ | `POST /api/files/:id/preview/video/prepare` 排队；`GET /api/files/:id/preview/video/status` 轮询；`GET /api/files/:id/preview/video` 流式输出 | `TASK_TYPE_CONCURRENCY_gif_preview`（可选） | [video.rs](file:///Users/tyone/github/upload-download-util/backend/src/handlers/files/video.rs) |
| Worker 转码任务（gif_preview + hls_preview） | ✅ | prepare/status + worker 消费；两种任务类型均走同一队列 | `WORKER_CONCURRENCY` | [worker.rs](file:///Users/tyone/github/upload-download-util/backend/src/bin/worker.rs) / [task_queue.rs](file:///Users/tyone/github/upload-download-util/backend/src/services/task_queue.rs) |
| 转码并发配额（全局 + task_type） | ✅ | 限制 CPU/IO，避免互相影响；gif_preview 与 hls_preview 各自独立配额 | `TRANSCODE_MAX_CONCURRENT` / `TASK_TYPE_CONCURRENCY_*` | [worker.rs](file:///Users/tyone/github/upload-download-util/backend/src/bin/worker.rs) |
| Postgres 队列（lease/backoff/requeue/metrics） | ✅ | 多实例竞争消费 + 卡死回收；gif/hls 两类任务均覆盖 | `TASK_QUEUE_BACKEND=postgres` | [task_queue.rs](file:///Users/tyone/github/upload-download-util/backend/src/services/task_queue.rs) |
| Admin 后台任务管理（list/retry） | ✅ | `GET /api/admin/tasks` 查询任务；`POST /api/admin/tasks/:id/retry` 重试失败任务 | `ADMIN_TOKEN` | [admin.rs](file:///Users/tyone/github/upload-download-util/backend/src/handlers/admin.rs) |

### 1.3 搜索与 AI 能力

| 对标项 | 状态 | 本地验证（接口/行为） | 开关/配置 | 代码入口 |
| --- | --- | --- | --- | --- |
| 语义搜索（向量相似度） | ✅ | `GET /api/files/search/semantic?q=...&limit=20&threshold=0.5`；pgvector 余弦距离排序 | `HUGGINGFACE_API_TOKEN`（必需，否则返回 503） | [semantic_search.rs handler](file:///Users/tyone/github/upload-download-util/backend/src/handlers/files/semantic_search.rs) / [file/semantic_search.rs](file:///Users/tyone/github/upload-download-util/backend/src/services/file/semantic_search.rs) |
| 向量嵌入生成（Hugging Face API） | ✅ | 上传/更新文件时异步生成 384 维向量；支持单条与批量 | `HUGGINGFACE_MODEL_ID`（默认 all-MiniLM-L6-v2） / `HUGGINGFACE_API_URL` | [embeddings.rs](file:///Users/tyone/github/upload-download-util/backend/src/services/embeddings.rs) |
| 多格式文件内容提取 | ✅ | 支持 PDF/DOCX/HTML/TXT/MD/JSON/XML/CSV；上传时自动提取后用于生成 embedding | 无（自动匹配 MIME） | [file_content_extractor.rs](file:///Users/tyone/github/upload-download-util/backend/src/services/file_content_extractor.rs) |

### 1.4 文件组织与版本

| 对标项 | 状态 | 本地验证（接口/行为） | 开关/配置 | 代码入口 |
| --- | --- | --- | --- | --- |
| 文件夹层级管理 | ✅ | CRUD + 移动 + 面包屑导航 + 批量移动文件到文件夹 + 递归获取文件夹内全部文件 ID | 无 | [folders.rs handler](file:///Users/tyone/github/upload-download-util/backend/src/handlers/folders.rs) / [folder.rs service](file:///Users/tyone/github/upload-download-util/backend/src/services/folder.rs) |
| 文件版本管理 | ✅ | `GET /api/files/:id/versions` 列出历史版本；`POST /:id/versions/:vid/restore` 恢复；`PUT /versions/:vid/label` 打标签；`DELETE /versions/:vid` 删除版本 | 自动保留最近 N 个版本（可配） | [versions.rs handler](file:///Users/tyone/github/upload-download-util/backend/src/handlers/files/versions.rs) / [file/versions.rs](file:///Users/tyone/github/upload-download-util/backend/src/services/file/versions.rs) |
| 文件分类（categories） | ✅ | `GET /api/files/categories` 按 MIME 类型分组统计 | 无 | [categories.rs](file:///Users/tyone/github/upload-download-util/backend/src/handlers/files/categories.rs) |

### 1.5 分享与协作

| 对标项 | 状态 | 本地验证（接口/行为） | 开关/配置 | 代码入口 |
| --- | --- | --- | --- | --- |
| 文件分享链接 | ✅ | `POST /api/shares` 创建分享（可选密码/过期时间/最大下载次数）；`GET /api/shares/:token` 访问；`GET /api/shares/:token/download` 下载；`DELETE /api/shares/:id` 删除 | `FRONTEND_URL`（用于构造完整 URL） | [share.rs handler](file:///Users/tyone/github/upload-download-util/backend/src/handlers/share.rs) / [share.rs service](file:///Users/tyone/github/upload-download-util/backend/src/services/share.rs) |
| 批量创建分享链接 | ✅ | `POST /api/shares/batch` 一次性为多个文件生成链接，返回成功与失败列表 | 同上 | [share.rs handler](file:///Users/tyone/github/upload-download-util/backend/src/handlers/share.rs) |
| 组织与多租户（RBAC） | ✅ | `POST /api/org` 创建组织；添加成员（按邮箱）；owner/admin/member 三级权限；团队文件共享（link/unlink/list） | 无独立开关 | [organization.rs](file:///Users/tyone/github/upload-download-util/backend/src/services/organization.rs) |

### 1.6 认证与安全

| 对标项 | 状态 | 本地验证（接口/行为） | 开关/配置 | 代码入口 |
| --- | --- | --- | --- | --- |
| JWT 用户认证（注册/登录/资料/改密） | ✅ | `POST /api/auth/register` / `POST /api/auth/login`；`GET /api/auth/me`；`PUT /api/auth/update-profile` / `PUT /api/auth/change-password` | `JWT_SECRET` / `JWT_EXPIRY` | [auth.rs](file:///Users/tyone/github/upload-download-util/backend/src/handlers/auth.rs) |
| OAuth 第三方登录（GitHub + Google） | ✅ | `GET /api/auth/oauth/github/url` 获取授权 URL；`GET /api/auth/oauth/github/callback` 回调换 JWT | `GITHUB_CLIENT_ID/SECRET` / `GOOGLE_CLIENT_ID/SECRET` / `*_REDIRECT_URI` | [oauth_github.rs](file:///Users/tyone/github/upload-download-util/backend/src/api/oauth_github.rs) / [oauth_google.rs](file:///Users/tyone/github/upload-download-util/backend/src/api/oauth_google.rs) |
| 邮箱验证（SMTP 发信） | ✅ | `POST /api/auth/send-email-verification` 发送验证码；`GET /api/auth/check-profile-availability` 检查用户名/邮箱可用 | `SMTP_HOST/PORT/USERNAME/PASSWORD/FROM` | [auth.rs](file:///Users/tyone/github/upload-download-util/backend/src/handlers/auth.rs) |
| API Token 认证 | ✅ | `POST /api/tokens` 创建 Token；`GET /api/tokens` 列出；`DELETE /api/tokens/:id` 撤销；所有接口均可用 Token 替代 JWT | 无独立开关 | [api_token.rs](file:///Users/tyone/github/upload-download-util/backend/src/handlers/api_token.rs) |
| 限流 429 + Retry-After（RFC 7231） | ✅ | IP 级 + 用户写操作级；429 携带 `Retry-After` / `X-RateLimit-*` | `IP_RATE_LIMIT` / `USER_RATE_LIMIT` / `RATE_LIMIT_WINDOW_SECS` | [rate_limit.rs](file:///Users/tyone/github/upload-download-util/backend/src/middleware/rate_limit.rs) |
| 图片代理（外链图片转发 + SSRF 防护） | ✅ | `GET /api/proxy/image?url=...`；禁止 localhost / 127.0.0.1 / ::1；仅允许 http/https | 无 | [proxy.rs](file:///Users/tyone/github/upload-download-util/backend/src/api/proxy.rs) |

### 1.7 缓存与数据

| 对标项 | 状态 | 本地验证（接口/行为） | 开关/配置 | 代码入口 |
| --- | --- | --- | --- | --- |
| Redis 分布式锁（缩略图/HLS） | ✅ | Redis 可用时防击穿；不可用自动降级 | `REDIS_URL`（可选） | [download/mod.rs](file:///Users/tyone/github/upload-download-util/backend/src/handlers/files/download/mod.rs) |
| Redis cache-aside（列表/分类/用量） | ✅ | 缓存成功响应；失败回源 | `CACHE_ENABLED` / `LIST_CACHE_TTL_SECS` 等 | [API_AND_CACHING_SELF_CHECK.md](file:///Users/tyone/github/upload-download-util/backend/docs/API_AND_CACHING_SELF_CHECK.md) |
| 读写分离（可选读库） | ✅ | 配了 `READ_REPLICA_DATABASE_URL` 读走 replica | `READ_REPLICA_DATABASE_URL`（可选） | [main.rs](file:///Users/tyone/github/upload-download-util/backend/src/main.rs) / [state.rs](file:///Users/tyone/github/upload-download-util/backend/src/state.rs) |

### 1.8 可观测性与运维

| 对标项 | 状态 | 本地验证（接口/行为） | 开关/配置 | 代码入口 |
| --- | --- | --- | --- | --- |
| Prometheus metrics + 路径简化 | ✅ | `GET /metrics` 暴露 Prometheus 指标 | 无 | [middleware/metrics.rs](file:///Users/tyone/github/upload-download-util/backend/src/middleware/metrics.rs) |
| 转码相关指标（gif + hls） | ✅ | `transcode_jobs_total` / `transcode_duration_seconds` / `background_tasks_*` 队列深度 | 无 | [task_queue.rs](file:///Users/tyone/github/upload-download-util/backend/src/services/task_queue.rs) / [worker.rs](file:///Users/tyone/github/upload-download-util/backend/src/bin/worker.rs) |
| 前端遥测事件上报 | ✅ | `POST /api/telemetry/events`；接收 event_type/action/status/duration_ms/error_message/file_id 等；打结构化日志到 `frontend_telemetry` target | 无独立开关 | [telemetry.rs](file:///Users/tyone/github/upload-download-util/backend/src/api/telemetry.rs) |
| 维护后台任务 | ✅ | 启动时自动运行：① ZIP 缓存 TTL 清理；② 过期分块上传会话清理（DB + 临时目录）；③ 文件一致性检查（DB→Storage）；④ 孤儿文件清理（Storage→DB，栈迭代 + 批量查库） | `ORPHAN_CLEANUP_INTERVAL_SECS` / `UPLOAD_SESSION_CLEANUP_INTERVAL_SECS` / `FILES_CONSISTENCY_CHECK_INTERVAL_SECS` 等 | [maintenance.rs](file:///Users/tyone/github/upload-download-util/backend/src/services/maintenance.rs) |
| 全局过载保护（LoadShed + ConcurrencyLimit） | ✅ | 全局并发 512；上传/分块/列表各有独立并发上限；过载时返回 503 | `UPLOAD_CONCURRENCY` / `LIST_CONCURRENCY` / `CHUNK_CONCURRENCY` 等常量 | [app.rs](file:///Users/tyone/github/upload-download-util/backend/src/app.rs) |
| DB 查询 / 文件操作 / 认证成功率指标 | 🟡 | `record_db_query` / `record_file_operation` / `record_auth_attempt` 已定义，尚未全部接入关键路径 | 无 | [middleware/metrics.rs](file:///Users/tyone/github/upload-download-util/backend/src/middleware/metrics.rs) |

---

## 2) 已知约束（为什么是 🟡）

| 能力 | 当前约束 | 如何变成 "云端可卸载/可扩容" |
| --- | --- | --- |
| `DOWNLOAD_MODE=redirect/presigned` | 仅 `STORAGE_BACKEND=s3` 支持（配置校验会拒绝其他组合） | 上 S3 + CDN；download/preview 走 302 或 CDN 域名 |
| HLS/ABR + GIF 转码 | 当前仅 `local` 存储支持转码（`storage_backend != "local"` 会直接返回 Validation 错误） | S3 场景先落临时文件再转码，或用云转码服务；产物上传对象存储 |
| `TASK_QUEUE_BACKEND` | 当前仅 `postgres` 支持（为未来 provider 预留） | 增加 Redis/Kafka/SQS provider 实现并放开校验 |
| 语义搜索 embedding | 依赖 Hugging Face Inference API（外部调用）；XLSX/PPTX 内容提取尚未实现 | 自托管 embedding 服务；补全 calamine/pptx 解析；批量异步化入队 |
| 文件版本恢复 | 恢复时会将版本文件重新写入存储，再更新 DB 记录；若 S3 场景需额外 copy-object 支持 | S3 场景改为 server-side copy；产物目录结构与 local 对齐 |
| DB 指标接入 | `record_db_query` 等函数已定义，但尚未在 repository 层的关键路径统一调用 | 在 SqlxFilesRepo / SqlxUsersRepo 的高频查询路径统一包装调用 |

---

## 3) 通用架构知识点（对标项保留，不删）

这一节不是"实现清单"，而是把顶级平台常见的架构知识点按主题梳理出来，并标注本项目**能复用的落地点**（即便当前不需要，也不应该从文档里删掉）。

### 3.1 微服务 + 无状态设计

- 是什么：把系统拆成多个服务（API/worker/媒体处理/推荐等），每个服务尽量无状态，状态放 DB/缓存/对象存储。
- 为什么：无状态服务更易水平扩容、更易灰度/滚动发布；服务边界清晰也利于隔离故障域。
- 怎么做（常见做法）：
  - 请求入口：LB（Nginx/Envoy）→ API（无状态）→ DB/缓存/对象存储
  - 异步任务：队列 → worker 集群
  - 状态：session/token/短期状态放 Redis；文件体放对象存储；元数据放 DB
- 本项目映射：
  - ✅ API 与 worker 已拆进程（二进制）：[main.rs](file:///Users/tyone/github/upload-download-util/backend/src/main.rs) / [worker.rs](file:///Users/tyone/github/upload-download-util/backend/src/bin/worker.rs)
  - ✅ 业务长任务已走队列/worker（gif_preview + hls_preview）：[task_queue.rs](file:///Users/tyone/github/upload-download-util/backend/src/services/task_queue.rs)
  - ✅ HLS/GIF prepare/status/playlist/asset 职责分离：prepare 排队，worker 转码，服务侧只读产物，status 可感知 FFmpeg 失败；进程重启任务不丢失
  - ✅ 组织/文件夹/分享/版本均以独立 Service 封装，与 HTTP 层解耦：[organization.rs](file:///Users/tyone/github/upload-download-util/backend/src/services/organization.rs) / [folder.rs](file:///Users/tyone/github/upload-download-util/backend/src/services/folder.rs) / [share.rs](file:///Users/tyone/github/upload-download-util/backend/src/services/share.rs)
  - ⏳ 进一步服务化：转码产物落对象存储，playlist/asset 走 `DOWNLOAD_MODE=presigned` 或 CDN

### 3.2 限流与抗压机制

- 是什么：在系统过载时限制请求速率、保护关键路径，避免雪崩（包括限流/排队/降级/熔断/隔离）。
- 为什么：高并发系统失败往往来自"资源被耗尽后级联失败"，抗压优先级高于"多跑一点业务逻辑"。
- 怎么做（常见做法）：
  - 多维度限流：IP、用户、路由、写操作、后台任务
  - 隔离资源池：转码/打包等重活单独配额或单独 worker
  - 失败策略：可重试错误 + backoff；不可用依赖 fail-open 或快速失败
  - 标准响应头：429 必须携带 `Retry-After`（RFC 7231 §7.1.3），告知客户端最短等待窗口
- 本项目映射：
  - ✅ API 层限流（Redis 可用时多实例一致）+ `Retry-After` 响应头：[rate_limit.rs](file:///Users/tyone/github/upload-download-util/backend/src/middleware/rate_limit.rs)
  - ✅ 全局 LoadShed + ConcurrencyLimit（512）+ 路由级独立并发上限（upload/chunk/list/complete）：[app.rs](file:///Users/tyone/github/upload-download-util/backend/src/app.rs) / [api/files.rs](file:///Users/tyone/github/upload-download-util/backend/src/api/files.rs)
  - ✅ 转码并发配额（全局 + task_type，gif/hls 各自独立）：[worker.rs](file:///Users/tyone/github/upload-download-util/backend/src/bin/worker.rs)
  - ✅ ZIP 打包并发隔离：`ZIP_BUILD_MAX_CONCURRENT`，[batch.rs](file:///Users/tyone/github/upload-download-util/backend/src/handlers/files/batch.rs)
  - ✅ HLS/缩略图防击穿锁：Redis lock（见自检文档），[API_AND_CACHING_SELF_CHECK.md](file:///Users/tyone/github/upload-download-util/backend/docs/API_AND_CACHING_SELF_CHECK.md)
  - ✅ 过载时返回标准 503 + JSON 错误结构，便于客户端统一解析

### 3.3 缓存体系（多层缓存）

- 是什么：把"读多写少"的热点从 DB 卸载出去（浏览器/边缘/CDN/Redis/进程内缓存/磁盘缓存）。
- 为什么：顶级平台的高并发本质是"命中率问题"；缓存比分库分表更早、更有效。
- 怎么做（常见做法）：
  - HTTP 条件缓存（ETag/Last-Modified/304）+ Range（断点续传）
  - Redis cache-aside（只缓存成功响应，TTL + 版本号失效）
  - 磁盘缓存（派生资源：缩略图、HLS、ZIP 产物、GIF 转码 mp4）
  - CDN：对象存储回源 + 长 TTL + 带签名
- 本项目映射：
  - ✅ 下载/预览的条件请求 + Range：[download/mod.rs](file:///Users/tyone/github/upload-download-util/backend/src/handlers/files/download/mod.rs)
  - ✅ Redis cache-aside + 锁：[API_AND_CACHING_SELF_CHECK.md](file:///Users/tyone/github/upload-download-util/backend/docs/API_AND_CACHING_SELF_CHECK.md)
  - ✅ 磁盘缓存：缩略图 `.thumbnails`、HLS `.hls`、GIF 派生 mp4 `.derived_videos`、ZIP 缓存（可选）：[CONFIG_AND_LIMITS.md](file:///Users/tyone/github/upload-download-util/backend/docs/CONFIG_AND_LIMITS.md)
  - ✅ Redis 版本号失效（bump_user_cache_version）：写操作后 bump，列表缓存自动失效：[redis.rs](file:///Users/tyone/github/upload-download-util/backend/src/services/redis.rs)
  - ⏳ CDN/边缘缓存：通过 `DOWNLOAD_MODE=presigned/redirect` 作为卸载入口对接

### 3.4 读写分离与数据扩展

- 是什么：把读流量从主库卸载到只读副本；极端规模下才考虑分片/分库分表。
- 为什么：大多数场景"读写分离 + 缓存"就能覆盖数量级增长；过早分片会让复杂度飙升。
- 怎么做（常见做法）：
  - primary/replica：读走 replica，写走 primary
  - 一致性：对强一致读走 primary；其余走 replica 允许秒级延迟
  - 分片：按 user_id 或 content_id 做路由（通常最后一步）
- 本项目映射：
  - ✅ 可选读库：`READ_REPLICA_DATABASE_URL`，[main.rs](file:///Users/tyone/github/upload-download-util/backend/src/main.rs) / [state.rs](file:///Users/tyone/github/upload-download-util/backend/src/state.rs)
  - ✅ pgvector 余弦相似度搜索（语义搜索）：通过 `<=>` 运算符在 Postgres 侧完成，无需外部向量数据库：[file/semantic_search.rs](file:///Users/tyone/github/upload-download-util/backend/src/services/file/semantic_search.rs)
  - ⏳ 分片/分库分表：保留为路线图项（本仓库目前不需要）

### 3.5 可观测性（Metrics/Logging/Telemetry）

- 是什么：让你在"高并发 + 多实例"情况下仍能回答：哪里慢、哪里错、是否过载、队列堆积多少。
- 为什么：没有可观测性，开关/扩容/降级都是盲飞。
- 怎么做（常见做法）：
  - 关键指标：RPS、P95/P99、错误率、队列深度、转码耗时、缓存命中率
  - 结构化日志：带 request_id/task_id/user_id/file_id
  - 前端上报：QoE 指标（首帧、卡顿、上传耗时、错误率）
- 本项目映射：
  - ✅ Prometheus metrics 与路径简化：[middleware/metrics.rs](file:///Users/tyone/github/upload-download-util/backend/src/middleware/metrics.rs)
  - ✅ 转码相关指标（gif_preview + hls_preview）：`transcode_jobs_total` / `transcode_duration_seconds` / `background_tasks_*` 队列深度，[task_queue.rs](file:///Users/tyone/github/upload-download-util/backend/src/services/task_queue.rs) / [worker.rs](file:///Users/tyone/github/upload-download-util/backend/src/bin/worker.rs)
  - ✅ 前端遥测事件上报（event_type/action/status/duration_ms/file_size）：`POST /api/telemetry/events`，[telemetry.rs](file:///Users/tyone/github/upload-download-util/backend/src/api/telemetry.rs)
  - ✅ 请求日志中间件（RequestLogLayer）：结构化记录每条请求的 method/path/status/latency
  - 🟡 DB 查询 / 文件操作 / 认证成功率指标：`record_db_query` / `record_file_operation` / `record_auth_attempt` 已定义，尚未在关键路径统一调用；接入后可在 Grafana 看到逐表 QPS 与平均耗时
  - 🟡 队列深度→自动弹性伸缩：已具备指标，是否接 HPA/KEDA 属于部署侧

### 3.6 安全与访问控制

- 是什么：确保"谁能访问什么资源"在每一层都有守护，防止越权、注入与外部攻击。
- 为什么：文件系统是高价值数据，未授权访问会直接造成数据泄露或滥用。
- 怎么做（常见做法）：
  - 认证：JWT（短期）+ Refresh Token 或 API Key；OAuth 代理第三方登录
  - 授权：资源归属校验（user_id 匹配）+ RBAC（组织级别权限）
  - 防护：SSRF 防护、CORS 配置、请求体大小限制、上传类型白名单
- 本项目映射：
  - ✅ JWT + API Token 双轨认证：[auth.rs](file:///Users/tyone/github/upload-download-util/backend/src/handlers/auth.rs) / [api_token.rs](file:///Users/tyone/github/upload-download-util/backend/src/handlers/api_token.rs)
  - ✅ GitHub + Google OAuth：[oauth_github.rs](file:///Users/tyone/github/upload-download-util/backend/src/api/oauth_github.rs) / [oauth_google.rs](file:///Users/tyone/github/upload-download-util/backend/src/api/oauth_google.rs)
  - ✅ 组织 RBAC（owner/admin/member）：所有组织操作均先校验成员角色，[organization.rs](file:///Users/tyone/github/upload-download-util/backend/src/services/organization.rs)
  - ✅ 分享链接安全（密码哈希、过期校验、下载次数上限）：[share.rs service](file:///Users/tyone/github/upload-download-util/backend/src/services/share.rs)
  - ✅ 图片代理 SSRF 防护（禁止 localhost / 私有地址，仅 http/https）：[proxy.rs](file:///Users/tyone/github/upload-download-util/backend/src/api/proxy.rs)
  - ✅ 请求体大小限制（`RequestBodyLimitLayer`）+ MIME 类型白名单：[api/files.rs](file:///Users/tyone/github/upload-download-util/backend/src/api/files.rs) / [config.rs](file:///Users/tyone/github/upload-download-util/backend/src/config.rs)

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
| QoE 指标（卡顿率/首帧/码率切换） | 🟡 | 前端遥测上报框架已落地（telemetry events）；QoE 专项指标尚未单独采集与聚合 |

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
| 转码产物落对象存储 | ⏳ | 把 `.hls` / `.derived_videos` 产物上传到 S3，并让对应接口走 `DOWNLOAD_MODE=presigned` 或 CDN |

### 4.4 转码基础设施

| 对标项 | 状态 | 备注（落地策略建议） |
| --- | --- | --- |
| GPU 编码（NVENC） | ⏳ | 云端 worker 直接替换 ffmpeg 编码参数即可；仍保留并发配额 |
| HLS/ABR 进队列异步化 | ✅ | 已落地：prepare 排队入 `background_tasks`，worker 消费，status 感知失败，进程重启任务可恢复 |
| GIF → MP4 进队列异步化 | ✅ | 已落地：与 HLS 共用同一 task_queue；gif_preview 幂等 dedupe_key 防重复排队 |
| XLSX / PPTX 内容提取 | ⏳ | 当前返回空字符串跳过；可引入 calamine（xlsx）/ pptx-rs 补全，提升语义搜索覆盖率 |

### 4.5 数据与业务（非核心但常见）

| 对标项 | 状态 | 备注（落地策略建议） |
| --- | --- | --- |
| 数据库分片/分库分表 | ⏳ | 当前读写分离已足够；分片只在数据量/写入量上来后再做 |
| 推荐系统/行为日志流 | ⏳ | 不属于"上传下载工具"的必需能力；若要做可单独服务化，不建议耦合进本仓库 |
| embedding 批量回填（历史文件） | ⏳ | `SemanticSearchService::batch_update_embeddings` 已实现；需要一次性触发脚本或 Admin 接口驱动 |
| 组织级配额/计费 | ⏳ | 当前配额仅在用户维度；组织级资源用量聚合与限额可在 `OrganizationService` 中扩展 |