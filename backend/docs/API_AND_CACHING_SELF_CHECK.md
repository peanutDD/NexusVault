# API 与缓存自检（含 Redis 落地）

> 📅 日期：2026-02-22  
> 🧰 自检依据：`comment-gen`、`caching`、`api-design`、`api-pagination`、`api-error-handling`、`api-authentication`、`api-security-hardening`、`api-response-optimization`

## 1. 范围与目标

本文档面向“当前代码的真实行为”做一次可落地的自检总结，目标是：

- 明确 API 的认证方式、分页协议、错误格式与缓存策略（客户端如何正确使用）
- 说明 Redis 在本项目里的定位（多实例一致性、缓存、分布式锁）
- 记录关键的反效果规避点（不缓存错误、不缓存大对象、Redis 故障不拖垮主链路）

## 2. API 自检（api-* skills）

### 2.1 版本与路由挂载

- 同一套路由同时挂在 `/api/*` 与 `/api/v1/*`（便于兼容/迁移）：[app.rs](file:///Users/tyone/github/upload-download-util/backend/src/app.rs#L85-L115)
- 路由聚合入口：[api/mod.rs](file:///Users/tyone/github/upload-download-util/backend/src/api/mod.rs#L16-L38)

### 2.2 认证（JWT / API Token / Query Token）

- 默认：`Authorization: Bearer <token>`，支持 JWT 与 API Token 自动识别：[extractors/auth.rs](file:///Users/tyone/github/upload-download-util/backend/src/extractors/auth.rs#L28-L209)
- 仅 GET 场景支持 `?token=...`（预览/下载/缩略图等），非 GET 会拒绝（避免泄露/误用）：[AuthenticatedUserQuery](file:///Users/tyone/github/upload-download-util/backend/src/extractors/auth.rs#L55-L88)
- OAuth state（GitHub/Google）使用一次性 state 防 CSRF；Redis 可用时写 Redis，未配置则回退内存缓存：[oauth_github.rs](file:///Users/tyone/github/upload-download-util/backend/src/api/oauth_github.rs)、[oauth_google.rs](file:///Users/tyone/github/upload-download-util/backend/src/api/oauth_google.rs)

### 2.3 分页（offset + cursor）

文件列表 `GET /files/` 同时支持两类分页：[FileListQuery](file:///Users/tyone/github/upload-download-util/backend/src/models/file.rs#L87-L140)

- 传统分页：`page` + `limit`，响应 `{ files, total, page, limit }`：[list_files_handler](file:///Users/tyone/github/upload-download-util/backend/src/handlers/files/list.rs#L36-L63)
- 游标分页（keyset）：传 `cursor` 即启用，响应 `{ files, next_cursor }`：[repositories/files.rs](file:///Users/tyone/github/upload-download-util/backend/src/repositories/files.rs#L369-L701)
- 性能开关：`include_total=false` 可跳过 `COUNT(*) OVER()`（仅传统分页有效）：[FileListQuery#include_total](file:///Users/tyone/github/upload-download-util/backend/src/models/file.rs#L127-L133)

### 2.4 错误响应（统一与例外）

- 统一错误：`AppError` 映射 HTTP 状态码并返回 JSON（包含 `code/error_id/timestamp` 等）：[error.rs](file:///Users/tyone/github/upload-download-util/backend/src/utils/error.rs#L139-L342)
- 已完成统一：过载保护与限流等非 `AppError` 场景也改为同一错误结构（`message/code/error_id/timestamp`），并默认 `Cache-Control: private, no-store`：[app.rs](file:///Users/tyone/github/upload-download-util/backend/src/app.rs#L54-L66)、[rate_limit.rs](file:///Users/tyone/github/upload-download-util/backend/src/middleware/rate_limit.rs)、[response.rs](file:///Users/tyone/github/upload-download-util/backend/src/utils/response.rs)

### 2.5 响应缓存（HTTP 层）

二进制下载链路的 HTTP 缓存策略完整且可复用：

- 下载/预览：Weak ETag、Last-Modified、If-* 预条件、Range 断点续传：[download/mod.rs](file:///Users/tyone/github/upload-download-util/backend/src/handlers/files/download/mod.rs#L33-L178)
- Cache-Control 约定：
  - 下载 attachment：`private, max-age=0, must-revalidate`
  - 预览 inline：`private, max-age=3600`
  - 缩略图：`public, max-age=86400`
  见：[headers.rs](file:///Users/tyone/github/upload-download-util/backend/src/handlers/files/download/headers.rs#L45-L59)、[constants.rs](file:///Users/tyone/github/upload-download-util/backend/src/constants.rs#L73-L85)

## 3. 缓存自检（caching skill）

### 3.1 现状：三层缓存并存

- **HTTP 条件缓存**：下载/预览/缩略图（ETag/304、Range）见上文。
- **进程内缓存（moka）**：用户/文件/文件夹、验证码、OAuth state、限流计数（单实例）：
  - [cache.rs](file:///Users/tyone/github/upload-download-util/backend/src/services/cache.rs)
  - [rate_limit.rs](file:///Users/tyone/github/upload-download-util/backend/src/middleware/rate_limit.rs)
- **磁盘缓存**：缩略图 `.thumbnails`、HLS `.hls` 产物复用。

### 3.2 Redis 落地：解决多实例一致性 + 分布式能力

Redis 为“可选依赖”：配置 `REDIS_URL` 时启用，否则自动回退到单机逻辑。

- Redis 连接池与操作封装：[redis.rs](file:///Users/tyone/github/upload-download-util/backend/src/services/redis.rs)
- Docker 运行方式（开发/自测）：[docker-compose.yml](file:///Users/tyone/github/upload-download-util/docker-compose.yml)
- 环境变量说明：[.env.example](file:///Users/tyone/github/upload-download-util/backend/.env.example)、[CONFIG_AND_LIMITS.md](file:///Users/tyone/github/upload-download-util/backend/docs/CONFIG_AND_LIMITS.md)

### 3.3 已实现的 Redis 使用点（按优先级）

1) **短期一致性状态（强收益）**

- 邮箱验证码：Redis 可用时写 Redis，校验后删除；未配置则回退内存缓存：[auth.rs](file:///Users/tyone/github/upload-download-util/backend/src/services/auth.rs#L285-L387)
- OAuth state：GitHub/Google state 写 Redis 或回退内存缓存：[oauth_github.rs](file:///Users/tyone/github/upload-download-util/backend/src/api/oauth_github.rs)、[oauth_google.rs](file:///Users/tyone/github/upload-download-util/backend/src/api/oauth_google.rs)

2) **限流计数（多实例一致）**

- Redis 可用时用 `EVAL` 脚本原子执行 `INCR + EXPIRE` 固定窗口；Redis 不可用时 fail-open（不把 Redis 抖动升级为全站故障）：[rate_limit.rs](file:///Users/tyone/github/upload-download-util/backend/src/middleware/rate_limit.rs)

3) **高频读接口缓存（Cache-aside + 版本号失效）**

- 缓存对象：文件列表、分类列表、存储用量（仅缓存成功的 JSON 响应，不缓存错误）
- 失效策略：`cachever:user:{user_id}`（版本号）；写操作后 `INCR` 即可整体失效，避免 `SCAN + DEL`
  - 文件列表：[list.rs](file:///Users/tyone/github/upload-download-util/backend/src/handlers/files/list.rs)
  - 分类列表：[categories.rs](file:///Users/tyone/github/upload-download-util/backend/src/handlers/files/categories.rs)
  - 存储用量：[storage.rs](file:///Users/tyone/github/upload-download-util/backend/src/handlers/files/storage.rs)
  - 写路径 bump 版本号：上传/秒传/分片完成/删除/批量删除/批量移动/版本恢复等（见各 handler 内 `bump_user_cache_version` 调用）

4) **分布式锁（防击穿/重算）**

- 缩略图生成：`lock:thumb:{file_id}:{w}`，避免多实例并发重复压缩；拿到锁的实例会在完成后主动释放（DEL）：[download/mod.rs](file:///Users/tyone/github/upload-download-util/backend/src/handlers/files/download/mod.rs#L216-L381)
- HLS 转码：`lock:hls:{file_id}`，避免多实例并发重复 ffmpeg；拿不到锁会等待就绪，超时返回 503 让客户端重试（避免重复转码）：[download/mod.rs](file:///Users/tyone/github/upload-download-util/backend/src/handlers/files/download/mod.rs#L368-L516)
  - 503 会携带 `Retry-After`（默认 2s）并返回 m3u8 占位内容，前端播放器可据此做更友好的重试策略：[response.rs](file:///Users/tyone/github/upload-download-util/backend/src/utils/response.rs)、[useFilePreviewEffects.ts](file:///Users/tyone/github/upload-download-util/frontend/src/components/files/preview/hooks/useFilePreviewEffects.ts)

## 4. 反效果规避（本次实现的约束）

- **不缓存错误**：Redis 缓存命中仅在 JSON 反序列化成功时返回；失败直接走源逻辑。
- **不缓存大对象**：下载/预览走 HTTP 缓存（ETag/Range），不会把文件体塞 Redis。
- **Redis 故障不拖垮主链路**：限流 Redis 失败直接放行；读缓存失败走源查询（以可用性优先）。
- **所有缓存有 TTL**：短期状态（验证码/OAuth state）与读缓存均设置过期时间，避免永久脏数据。
- **JSON 默认不落盘不缓存**：所有 JSON 响应默认 `Cache-Control: private, no-store`，降低敏感数据被代理/浏览器缓存风险：[response.rs](file:///Users/tyone/github/upload-download-util/backend/src/utils/response.rs)、[error.rs](file:///Users/tyone/github/upload-download-util/backend/src/utils/error.rs)

## 5. comment-gen 自检结论（不改代码注释，改“文档化”）

本仓库复杂度主要集中在：

- 文件列表的动态 SQL 组装（筛选+排序+两种分页）：[files.rs(list)](file:///Users/tyone/github/upload-download-util/backend/src/repositories/files.rs#L369-L701)
- 下载/预览的条件请求与 Range 协议实现：[download/mod.rs](file:///Users/tyone/github/upload-download-util/backend/src/handlers/files/download/mod.rs#L33-L178)
- 分片上传与会话生命周期（HTTP 层 + service 层）：[chunked_upload.rs](file:///Users/tyone/github/upload-download-util/backend/src/handlers/files/chunked_upload.rs)

当前策略是优先保证“文档即真相”：复杂行为以本文件 + 对应 handler/repo 的链接作为维护入口，避免注释漂移造成误导。

## 6. 后续建议（可选）

- 统一过载/限流等中间件的错误响应格式，使其与 `AppError` 完全一致（便于客户端统一解析）
- 将 Redis 缓存/锁/限流的 TTL、等待时长做成可配置项（环境变量 → Config），便于生产调参
- OpenAPI 补齐 `bearerAuth`、分页参数、错误 schema 与主要 endpoint 的 `#[utoipa::path]`，让 API 文档可自动生成：[openapi.rs](file:///Users/tyone/github/upload-download-util/backend/src/api/openapi.rs#L1-L62)
