# 配置项与业务上限对应关系

便于运维调参：请求体/业务上限由哪些配置或常量控制。

## 配置项（环境变量 → Config）

| 环境变量 | 说明 | 默认值 |
|----------|------|--------|
| `DATABASE_URL` | PostgreSQL 连接串 | 必填 |
| `REDIS_URL` | Redis 连接串（不配置则禁用 Redis 能力） | 可选 |
| `JWT_SECRET` | JWT 签名密钥 | 必填 |
| `JWT_EXPIRY` | JWT 过期时间 | `24h` |
| `PORT` | 服务监听端口 | `3000` |
| `STORAGE_BACKEND` | 存储后端 | `local` |
| `STORAGE_PATH` | 本地存储根目录 | `./uploads` |
| `MAX_FILE_SIZE` | **单文件上传大小上限（字节）**，业务校验用 | `2147483648`（2GiB） |
| `ALLOWED_MIME_TYPES` | 允许的 MIME 类型（逗号分隔） | `image/*,video/*,...` |
| `CORS_ORIGIN` | CORS 允许的源 | `*` |
| `HLS_THRESHOLD_BYTES` | 超过此大小的视频走 HLS 转码预览（字节） | `104857600`（100MiB） |
| `UPLOAD_SESSION_CLEANUP_*` / `FILES_CONSISTENCY_CHECK_*` / `ORPHAN_CLEANUP_*` | 后台维护任务间隔与批次 | 见 config.rs 注释 |
| （预留）`GIF_PREVIEW_WORKER_CONCURRENCY` | GIF 预览转码 Worker 并行度 | 若未设置则使用代码内默认值（当前为 2） |
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
