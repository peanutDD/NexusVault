# 功能开关矩阵与接口边界

> 本文件定义高并发全量落地方案的功能开关（Feature Flags）和可替换的 Provider 接口边界。

---

## 0) 总体原则

- **读链路优先缓存**：先降低DB压力，再谈分库分表
- **大流量从API卸载**：下载/预览/分发尽量走对象存储 + CDN
- **重活全部异步化**：转码/压缩等CPU/IO密集任务必须走队列 + worker
- **每条链路可独立扩容**：API、worker、存储/缓存、DB都是独立伸缩维度

---

## 1) 开关矩阵（Feature Flags）

| 开关名 | 默认值（本地） | 本地行为 | 云上行为 | 主要模块 |
|--------|---------------|----------|----------|----------|
| `ZIP_CACHE_ENABLED` | `0` | 边打包边传 | 产物写对象存储 + CDN缓存 | 后端：批量ZIP |
| `ZIP_CACHE_BACKEND` | `local` | 落盘缓存 | `s3`：落对象存储 | ZipArtifactStore |
| `CACHE_ENABLED` | `1` | memory/redis cache-aside | Redis/ElastiCache | CacheProvider |
| `CACHE_BACKEND` | `redis` | 有REDIS_URL才启用，否则降级memory | `redis` | CacheProvider |
| `TRANSCODE_MAX_CONCURRENT` | `2` | 限制转码并发 | GPU/多worker时保留配额 | worker：转码执行器 |
| `DOWNLOAD_MODE` | `proxy` | 下载走API代理 | `presigned` / `redirect` | DownloadLinkProvider |
| `ENABLE_HTTP_CACHE_HEADERS` | `1` | 加Cache-Control/ETag | CDN直接命中缓存 | response utils |

---

## 2) Provider接口边界

### 2.1 ZipArtifactStore（ZIP产物缓存）
- **职责**：get/put/delete/gc
- **实现**：`LocalZipArtifactStore`、`S3ZipArtifactStore`

### 2.2 CacheProvider（元数据/列表缓存）
- **职责**：get_json/set_json/del
- **策略**：cache-aside、读miss回源DB、写操作后失效相关key
- **实现**：`MemoryCacheProvider`、`RedisCacheProvider`

### 2.3 TaskQueueProvider（后台任务队列）
- **职责**：enqueue/dequeue/ack/succeed/fail/retry
- **实现**：`PostgresTaskQueueProvider`（已存在）

### 2.4 DownloadLinkProvider（下载直链/签名）
- **职责**：resolve_download(file, mode) -> Proxy/Redirect/Presigned
- **实现**：`LocalDownloadLinkProvider`、`S3PresignedDownloadLinkProvider`

---

## 3) 实施顺序映射

1. ZIP产物缓存复用：`ZIP_CACHE_*` + `ZipArtifactStore`
2. Redis cache-aside：`CACHE_*` + `CacheProvider`
3. 转码配额 + 多队列隔离：`TRANSCODE_MAX_CONCURRENT`
4. Provider化：`DOWNLOAD_MODE`、`TASK_QUEUE_BACKEND`
5. ABR多码率：`HLS_ABR_MAX_VARIANTS` + `HLS_ABR_VARIANTS`