# 配置项与业务上限对应关系

便于运维调参：请求体/业务上限由哪些配置或常量控制。

## 配置项（环境变量 → Config）

| 环境变量 | 说明 | 默认值 |
|----------|------|--------|
| `DATABASE_URL` | PostgreSQL 连接串 | 必填 |
| `REDIS_URL` | Redis 连接串（不配置则禁用 Redis 能力） | 可选 |
| `JWT_SECRET` | JWT 签名密钥 | 必填 |
| `API_TOKEN_HMAC_SECRET` | API Token HMAC 密钥（不配则回退用 `JWT_SECRET`） | 可选 |
| `API_TOKEN_HMAC_SECRET_PREVIOUS` | API Token 上一把 HMAC 密钥（用于平滑轮换/双验） | 可选 |
| `JWT_EXPIRY` | JWT 过期时间 | `24h` |
| `PORT` | 服务监听端口 | `3000` |
| `STORAGE_BACKEND` | 存储后端 | `local` |
| `STORAGE_PATH` | 本地存储根目录（多实例/容器时 API 与 Worker 必须共享同一路径/卷） | `./uploads` |
| `MAX_FILE_SIZE` | **单文件上传大小上限（字节）**，业务校验用 | `2147483648`（2GiB） |
| `ALLOWED_MIME_TYPES` | 允许的 MIME 类型（逗号分隔） | `image/*,video/*,...` |
| `CORS_ORIGIN` | CORS 允许的源 | `*` |
| `HLS_THRESHOLD_BYTES` | 超过此大小的视频走 HLS 转码预览（字节） | `104857600`（100MiB） |
| `HLS_ABR_MAX_VARIANTS` | HLS 多码率：启用的最大档位数（1=单档；>1 生成 master.m3u8 + variants） | `1` |
| `HLS_ABR_VARIANTS` | HLS 多码率档位列表（`height:video_kbps`，逗号分隔） | `240:350,360:700,480:1200,720:2500` |
| `UPLOAD_SESSION_CLEANUP_*` / `FILES_CONSISTENCY_CHECK_*` / `ORPHAN_CLEANUP_*` | 后台维护任务间隔与批次 | 见 config.rs 注释 |
| `WORKER_CONCURRENCY` | worker 进程内并发轮询数（每个循环尝试取 1 个任务） | `2` |
| `WORKER_PORT` | worker metrics/health 监听端口 | `3001` |
| `TRANSCODE_MAX_CONCURRENT` | 转码全局并发配额（跨 task_type） | `2` |
| `TASK_TYPE_CONCURRENCY_gif_preview` | gif_preview 专用并发上限（可选） | `2` |
| `ZIP_CACHE_ENABLED` | ZIP 产物缓存开关 | `0` |
| `ZIP_CACHE_TTL_SECS` | ZIP 产物缓存 TTL（秒） | `3600` |
| `ZIP_BUILD_MAX_CONCURRENT` | 批量 ZIP 打包并发配额 | `2` |
| `CACHE_ENABLED` | Redis cache-aside 总开关（未配置 `REDIS_URL` 会自动降级） | `1` |
| `CACHE_DEFAULT_TTL_SECS` | 默认缓存 TTL（秒） | `60` |
| `LIST_CACHE_TTL_SECS` | 文件列表第一页缓存 TTL（秒） | `20` |
| `DOWNLOAD_MODE` | 下载模式：`proxy`（默认）/ `redirect`/ `presigned`（需 `STORAGE_BACKEND=s3`） | `proxy` |
| `PRESIGN_TTL_SECS` | presigned URL 有效期（秒） | `300` |
| `TASK_QUEUE_BACKEND` | 任务队列后端（当前仅 `postgres`） | `postgres` |
| `READ_REPLICA_DATABASE_URL` | 读库连接串（不配则读写同库） | 可选 |
| `IP_RATE_LIMIT` | IP 级限流：每窗口内最大请求数 | `600` |
| `USER_RATE_LIMIT` | 已登录用户写操作限流：每窗口内最大请求数 | `600` |
| `RATE_LIMIT_WINDOW_SECS` | 限流窗口大小（秒） | `60` |
| `RATE_LIMIT_MAX_KEYS` | 限流缓存最大 key 数 | `20000` |
| `TRUST_PROXY_HEADERS` | 是否信任 `Forwarded/X-Forwarded-For/X-Real-IP` 作为客户端 IP（仅在可信反代场景开启） | `false` |
| `SMTP_HOST` | SMTP 服务器地址（修改邮箱验证码发送） | 可选，不配置则验证码仅写入日志 |
| `SMTP_PORT` | SMTP 端口 | 可选，如 587 |
| `SMTP_USERNAME` | SMTP 认证用户名（一般为发件邮箱） | 可选 |
| `SMTP_PASSWORD` | SMTP 认证密码（Gmail 需用应用专用密码） | 可选 |
| `SMTP_FROM` | 发件人地址 | 可选 |

## 请求体/业务上限（常量 → constants.rs）

| 用途 | 常量名 | 值 | 说明 |
|------|--------|-----|------|
| 普通上传请求体最大大小 | `MAX_UPLOAD_BODY` | 100 MiB | 与 `MAX_FILE_SIZE` 独立：body 解析上限 |
| 分块上传单块最大大小 | `MAX_CHUNK_BODY` | 3 MiB | 单次 PUT 块大小上限 |
| 分块上传标准块大小 | `CHUNK_SIZE` | 2 MiB | 前端约定 |
| 批量下载 ZIP 最大文件数 | `MAX_BATCH_ZIP_FILES` | 200 | 单次批量下载 |
| 批量下载 ZIP 最大总字节 | `MAX_BATCH_ZIP_TOTAL_BYTES` | 250 MiB | 单次批量下载 |
| 批量获取元数据最大 ID 数 | `MAX_BATCH_GET_IDS` | 100 | batch get 接口 |
| Range 请求最大分段数 | `MAX_RANGES` | 8 | 多 range 下载 |
| 每用户同时分片上传数 | `MAX_CONCURRENT_CHUNKED_UPLOADS` | 10 | 与前端约定（达到上限时会自动清理最旧的会话） |

## 磁盘预留（仅本地存储，constants.rs）

| 用途 | 常量名 | 值 |
|------|--------|-----|
| 普通上传前预留 | `DISK_RESERVE_UPLOAD` | 16 MiB |
| 分块上传前预留 | `DISK_RESERVE_CHUNK` | 32 MiB |
| 分块合并前预留 | `DISK_RESERVE_MERGE` | 64 MiB |

## 并发控制（constants.rs）

| 用途 | 常量名 | 值 |
|------|--------|-----|
| 文件列表并发 | `LIST_CONCURRENCY` | 12 |
| 普通上传并发 | `UPLOAD_CONCURRENCY` | 10 |
| 分块上传并发 | `CHUNK_CONCURRENCY` | 10 |
| 分块完成并发 | `COMPLETE_CONCURRENCY` | 2 |

调参时：**业务上传大小**看 `MAX_FILE_SIZE`；**单次请求体/批量个数**看 `constants.rs`；**维护任务**看 Config 对应环境变量。

## SMTP 配置（修改邮箱验证码）

修改邮箱时需发送验证码。配置 `SMTP_HOST`、`SMTP_FROM` 等后，验证码会通过 SMTP 发送到用户新邮箱；未配置时验证码仅写入后端日志（便于开发调试）。

### Gmail 示例

1. [Google 账号](https://myaccount.google.com/) → 安全性 → 开启两步验证
2. 安全性 → 两步验证 → 应用专用密码 → 生成 16 位密码
3. 在 `.env` 中配置：

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=你的Gmail@gmail.com
SMTP_PASSWORD=应用专用密码（16位）
SMTP_FROM=你的Gmail@gmail.com
```

> 注意：`SMTP_PASSWORD` 必须使用「应用专用密码」，不能填 Gmail 登录密码。

### QQ 邮箱 / 163 等

使用该邮箱的 SMTP 授权码（非登录密码），在邮箱设置中开启 SMTP 服务并获取授权码，填入 `SMTP_PASSWORD`。
