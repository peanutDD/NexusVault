# 配置项与业务上限对应关系

便于运维调参：请求体/业务上限由哪些配置或常量控制。

## 配置项（环境变量 → Config）

| 环境变量 | 说明 | 默认值 |
|----------|------|--------|
| `DATABASE_URL` | PostgreSQL 连接串 | 必填 |
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
| 每用户同时分片上传数 | `MAX_CONCURRENT_CHUNKED_UPLOADS` | 5 | 与前端约定 |

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
