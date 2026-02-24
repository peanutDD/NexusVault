# 后端工程手册（长期维护）

本文件用于沉淀**可复用的工程经验**（性能、稳定性、运行维护、压测、故障排查等）。后续新增经验建议直接追加在对应章节，或新增章节。

---

## 高并发下防止崩溃（单机 10 核 / PostgreSQL / max_connections=20）

### 目标与基本原则

- **目标**：在高并发压测（列表 + 上传）下，优先保证“服务不崩、整体可用”，而不是追求极限吞吐。
- **核心原则**：
  - **背压（Backpressure）**：资源接近打满时要“快速拒绝/快速失败”，而不是让请求无限排队。
  - **舱壁（Bulkhead）**：把不同类型的压力隔离开（列表、上传、分块、完成合并），避免单一热点拖垮全站。
  - **超时（Timeout）**：每一层都要超时（获取连接、SQL、请求处理），防止慢请求长期占用资源。
  - **避免大内存峰值**：上传/下载/合并要尽量**流式**，避免整文件 `Vec<u8>`。

---

## 已落地的工程措施（对应代码）

### 0) 代码结构升级：Handlers/Services/Repositories 解耦与模块化（重要）

近期对“文件域（files）”做了一次结构性重构，核心目标是：

- **Handlers 更薄**：只做 HTTP 层（参数解析、鉴权 extractor、响应构建、流式 body 拼装）。
- **Services 更纯**：只做业务编排（校验、存储调用、跨步骤流程），**不直接写 SQL**。
- **Repositories 专职数据访问**：集中管理 SQL/事务/动态查询构建（`sqlx::QueryBuilder`），减少散落 SQL 与 N+1。

落地结构：

- `src/handlers/files/`：按业务拆分（upload/instant_upload/chunked_upload/list/delete/batch/download/* 等）
- `src/services/file/`：按业务能力拆分（upload/instant_upload/chunked_upload/list/read/delete/batch_zip/quota/categories）
- `src/repositories/`：数据访问层（`files`/`users`/`upload_sessions`）

带来的直接收益：

- **可维护性**：单文件更小、职责更清晰，便于局部重构与单测。
- **低耦合**：改 SQL 不影响 service，改业务流程不需要到处搜 SQL。
- **性能**：容易发现并消灭 N+1（例如批量删除/批量 zip 的循环查询）。
- **安全性**：动态 SQL 更推荐用 `QueryBuilder + push_bind`，避免手写 `$1/$2` 计数和字符串拼接风险。

> 约定：后续新增数据库操作，优先加到 `src/repositories/*`，service 通过 repo 调用；仅在极少数需要跨 repo 事务且不便拆分时，才允许在 service 里直接写 SQL（并在注释说明原因）。

### 1) 路由级并发限制（快速背压）

对热点端点加了 **ConcurrencyLimit + LoadShed**，过载时返回 **503**（`SERVICE_OVERLOADED`），避免：

- DB 连接池排队导致任务堆积、内存上涨
- 文件 IO/CPU 被瞬间打满导致全站雪崩

位置：`src/api/files.rs`

- **列表**：`LIST_CONCURRENCY`
- **普通上传**：`UPLOAD_CONCURRENCY`
- **分块上传 chunk**：`CHUNK_CONCURRENCY`（当前 10，同时处理的分片请求数）
- **分块完成合并**：`COMPLETE_CONCURRENCY`

> 调参建议：在单机 10 核、`max_connections=20` 的前提下，先保持“保守值”，压测稳定后再逐步上调并观察 P95/P99 延迟和错误率。

---

### 2) 普通上传改为流式落盘（避免 OOM）

之前实现会把 multipart 文件字段一次性读入 `Vec<u8>`，高并发下容易造成：
\(并发数 \times 文件大小\) 级别内存峰值 → OOM/抖动。

现在改为：

- 读取 multipart 的 `chunk()`，边读边写到临时文件
- 再通过存储层的 `save_file_from_path` 保存到最终存储（Local/S3）

位置：`src/handlers/files/upload.rs`

注意事项：

- 临时目录位于系统 temp（`std::env::temp_dir()/file-storage-backend`），需确保磁盘空间充足。
- 上传失败会 best-effort 删除临时文件。

---

### 3) 分块上传完成改为流式合并（避免大文件合并 OOM）

之前实现会把所有 chunk 读入一个大 `Vec<u8>` 再写入存储；当允许大文件（甚至 GB 级）时，高并发几乎必崩。

现在改为：

- 创建 `merged_upload` 临时文件
- 逐块 `copy` 到合并文件并 `flush`
- 校验合并后文件大小
- 调用 `create_file_from_path` 写入最终存储并落库

位置：`src/services/file/chunked_upload.rs`（`complete_chunked_upload`）

---

### 4) 存储层支持“从路径保存”（减少内存拷贝）

新增 `StorageBackend::save_file_from_path`：

- **LocalStorage**：优先 `rename`（同盘原子、最快），失败则 `copy + delete` 兜底
- **S3Storage**：使用 `ByteStream::from_path` 进行上传（避免整文件进内存）

位置：`src/services/storage.rs`

---

### 5) 列表接口减少 DB 往返（降低连接占用）

列表接口以前是：

- `SELECT ... LIMIT/OFFSET`（取数据）
- `SELECT COUNT(*) ...`（取总数）

高并发下会把 DB 连接占用翻倍。

现在改为：

- 在同一条查询里使用 `COUNT(*) OVER() AS total_count`
- 只做一次 `fetch_all`

位置：

- `src/repositories/files.rs`（`FilesRepo::list_files`，`sqlx::QueryBuilder` 动态查询）
- `src/services/file/list.rs`（`FileService::list_files` 业务层封装）

备注：

- 当结果为空时 `total_count` 不存在，逻辑返回 `total=0`（符合预期）。

---

### 6) 连接池“更快失败” + SQL 超时（防慢查询雪崩）

连接池支持环境变量调参，高并发或批量下载时减少「pool timed out」：

- **`DB_POOL_MAX_CONNECTIONS`**（默认 40）：最大连接数
- **`DB_POOL_ACQUIRE_TIMEOUT_SECS`**（默认 15）：获取连接超时（秒）

并且在 `after_connect` 设置：

- `SET statement_timeout = '20s'`

位置：`src/database/pool.rs`；示例见 `backend/.env.example`。

调参建议：

- 列表通常应更短（如 2–5s），写入可略长（如 5–10s），建议按接口粒度做 `SET LOCAL statement_timeout=...`（在事务/单请求作用域内）。
- 若出现「pool timed out while waiting for an open connection」，可适当增大 `DB_POOL_MAX_CONNECTIONS` 或 `DB_POOL_ACQUIRE_TIMEOUT_SECS`（需与 PostgreSQL `max_connections` 协调）。

已落地：

- 列表接口在事务内执行 `SET LOCAL statement_timeout = '3s'`（避免把配置污染到连接池的其它请求）
  - 位置：`src/repositories/files.rs`（`FilesRepo::list_files`）

---

### 7) 下载/预览改为流式响应（避免下载时 OOM）

之前下载/预览通过 `get_file()` 读入 `Vec<u8>`，大文件 + 高并发下载时会产生巨大的内存峰值。

现在改为：

- `StorageBackend::open_read_stream` 统一返回可流式读取的源（Local 文件 / S3 ByteStream）
- handler 使用 `Body::from_stream(...)` 直接把数据“边读边发”
- `stream_file_response(...)` 统一设置 `Content-Type/Disposition/Length`

位置：

- `src/services/storage.rs`（`StorageReadStream` / `open_read_stream`）
- `src/services/file/read.rs`（`open_file_stream`）
- `src/handlers/files/download/mod.rs`（入口 handler）
- `src/utils/response.rs`（`stream_file_response`）

---

### 7.0) 批量下载 ZIP 流式（边打包边发，首包更早）

批量下载 ZIP 使用 POST /download-zip 流式响应，避免整包进内存、首包更早出现保存框：

- **`prepare_batch_zip_entries`**：校验数量/总大小并返回 `(File, ZIP 内条目名)` 列表，不做实际打包。
- **`run_zip_writer_thread`**（`src/services/file/batch_zip.rs`）：独立线程内用 `ZipWriter` + **`ChannelWriter`** 边打包边写入 `mpsc::SyncSender`；`ChannelWriter` 实现 `Write` + `Seek`（仅报告当前偏移，不回退），缓冲 **8KB 即发**，**每写完一个文件调用 `flush()`**，首包/小文件也能立刻发出。
- **handler**（`src/handlers/files/batch.rs` `batch_download_zip_post_handler`）：`prepare_batch_zip_entries` 后创建 channel，spawn 线程跑 `run_zip_writer_thread`，spawn tokio 任务按条目 `get_file_data` 并发送到 channel；响应体为 `Body::from_stream(stream)` 从 channel 读 `Bytes` 流式返回。
- **Range 断点续传（单段）**：当请求带 `Range: bytes=...` 时，先生成临时 ZIP，再按区间返回 **206 Partial Content**（`Content-Range` + `Accept-Ranges`）。为保证续传字节一致，ZIP 条目时间戳固定且条目顺序稳定。

位置：`src/services/file/batch_zip.rs`（`ChannelWriter`、`run_zip_writer_thread`、`prepare_batch_zip_entries`）、`src/handlers/files/batch.rs`（`batch_download_zip_post_handler`）。

---

### 7.1) 下载/预览支持 Range + ETag（进一步降带宽/提体验）

已落地：

- **ETag + If-None-Match**：命中则返回 **304**（仅在非 Range 情况下）
- **Range: bytes=...**：返回 **206 Partial Content**，并附带：
  - `Accept-Ranges: bytes`
  - `Content-Range: bytes start-end/total`
- **S3 Range**：对 S3 后端使用 `get_object().range("bytes=start-end")` 让对象存储侧只回传区间

位置：

- `src/services/storage.rs`（`open_read_stream_range`）
- `src/services/file/read.rs`（`open_file_stream_range`）
- `src/handlers/files/download/*`（Range/ETag/If-Range/Multipart 等子模块）

---

### 7.2) 后台任务队列：独立 Worker + 退避重试 + 卡死回收 + 最小管理 API

目标：

- API 服务只负责 **入队**（创建后台任务）与 **查询状态**，不在 API 进程内跑耗时任务
- Worker 作为独立部署单元可水平扩展（多实例并发消费），并有“生产级”基础：退避重试、lease、卡死回收、可观测性与人工干预入口

已落地能力：

- **独立 Worker binary**：`src/bin/worker.rs`
  - 默认 `WORKER_PORT=3001` 暴露 `/health` 与 `/metrics`
  - `WORKER_CONCURRENCY` 控制同一进程内并发消费 loop 数（默认 2）
- **任务调度字段**（DB）：`next_run_at` 与 `locked_until`
  - `next_run_at`：失败后指数退避重试；dequeue 仅取 `next_run_at <= now()` 的任务
  - `locked_until`：worker 认领任务时写入 lease，避免 worker 崩溃导致任务永久卡在 running
- **卡死任务回收**：worker 周期性调用 `requeue_stuck_tasks(task_type, limit)`，把超时 running 的任务重置回 pending
- **队列深度指标**：worker 定时查询 queue depth 并上报 gauge（pending_total/pending_ready/running/failed），可用于 HPA/KEDA 自动扩缩容
- **最小管理 API（管理员专用）**：
  - `ADMIN_TOKEN` 未配置时禁用 `/api/admin/*`
  - `GET /api/admin/tasks`：分页列出任务（可按 task_type/status 过滤）
  - `POST /api/admin/tasks/:id/retry`：将单个任务重置为 pending 以便重试

相关位置：

- 迁移：`migrations/021_add_background_tasks_scheduling.sql`
- 队列实现：`src/services/task_queue.rs`
- 管理接口：`src/api/admin.rs`、`src/handlers/admin.rs`、`src/extractors/admin.rs`

---

### 8) 更健壮的限流：有容量上限 + TTL（防止内存膨胀）

旧实现是 `HashMap<String, Vec<Instant>>` 的滑动窗口，特点是：

- 每个 key 会存一串时间戳（内存重）
- 高并发下清理与写锁竞争更明显
- 遇到大量不同 key（伪造 IP/随机 key）容易内存膨胀

现在改为：

- 使用 `moka::sync::Cache` 作为**有容量上限**（`max_capacity`）且**自动过期**（`time_to_live`）的计数器容器
- 每个 key 只存一个 `AtomicU32`（固定窗口计数）

位置：

- `src/middleware/rate_limit.rs`
- `src/main.rs`（`create_rate_limit_middleware(… , max_keys)`）

**分片上传单独处理**：路径包含 `upload/chunked` 的请求（init/chunk/status/complete/abort）**不参与**通用 500/分钟 限流计数，否则大文件分片（每块一请求）极易触发 429。该路径仍由各端点的 `ConcurrencyLimitLayer`（如 chunk 12 并发）保护。

---

### 9) 全局稳定性：捕获 panic + 优雅关闭

- **CatchPanicLayer**：捕获请求处理链路中的 panic，避免单次请求把服务打崩（尤其在未来若切到 `panic=abort` 前先把风险暴露出来）。
  - 位置：`src/main.rs`（middleware stack）
- **Graceful shutdown**：收到 SIGINT/SIGTERM 后停止接入新请求并优雅退出，减少部署/重启时的失败率。
  - 位置：`src/main.rs`（`with_graceful_shutdown(shutdown_signal())`）

---

### 10) 分块上传写盘“零拷贝”（减少一次 Vec 分配/复制）

分块上传 `PUT /upload/chunked/:id/chunk` 之前会把 `Bytes` 再 `to_vec()` 一次，造成额外内存分配与复制。

现在改为：

- handler 直接把 `Bytes` 传给 service
- `tokio::fs::write` 直接写入 `Bytes`（`Bytes: AsRef<[u8]>`）

位置：

- `src/handlers/files/chunked_upload.rs`（`chunked_upload_chunk_handler`）
- `src/services/file/chunked_upload.rs`（`upload_chunk`）

---

### 11) 避免“孤儿文件”（存储写入成功但落库失败）

高并发/异常场景下，可能出现：

- 文件已写入存储（本地磁盘/S3）
- 但 DB `INSERT files ...` 失败（连接超时、statement_timeout、临时故障等）

如果不处理，会产生“孤儿文件”长期占用存储空间。

已落地：

- `create_file` / `create_file_from_path` 在落库失败时 best-effort 执行 `storage.delete_file(file_path)` 清理。
  - 位置：`src/services/file/upload.rs`

---

### 12) 全局 in-flight 限制（兜底背压）

除了对 `files` 相关路由做并发闸门外，还加了一个**全局**兜底：

- `ConcurrencyLimitLayer(512) + LoadShedLayer`
- 触发时统一返回 503 `SERVICE_OVERLOADED`

作用：

- 防止“其它路由 + 文件路由叠加”的极端并发把进程拖死
- 让过载行为更可控（明确的 503，而不是超时/排队/内存膨胀）

位置：`src/main.rs`（middleware stack）

---

### 13) 后台清理过期分块上传（防磁盘堆积）

分块上传会把临时分块写到 `upload_sessions.temp_path` 指定目录；如果客户端中断、或用户不调用 abort/complete，就会留下临时目录。

已落地：

- 周期性清理 `upload_sessions.expires_at < NOW()` 的记录（批量）
- best-effort 删除 `temp_path` 目录
- 删除 DB 记录

位置：

- `src/services/maintenance.rs`（`spawn_upload_session_cleanup`）
- `src/main.rs`（启动时注册后台任务）

调参：

- interval：默认 5 分钟
- batch_size：默认 200

**13.1) 孤儿存储文件清理（存储 → DB 反向检查）**

与「DB 记录对应文件是否还在」相反：扫描本地存储目录，若某文件在磁盘上存在但 `files` 表无对应记录，则删除该文件（多为上传落盘成功、落库失败或未完成）。仅当 `storage_backend == "local"` 时启动；目录结构为 `{storage_path}/{user_id}/[可多层嵌套]/<file_id>/<文件名>`，递归扫描；跳过 `.thumbnails`、`.hls`、`.chunked`。`spawn_orphan_storage_files_cleanup`，默认每 600 秒、每轮最多删 500 个文件。

**13.2) 排查磁盘文件归属与孤儿（check_file_owners）**

用于确认「磁盘上某路径对应的 file_id 在库里是否存在、归属哪个 user_id」，区分「其他账号下的文件」与「无记录的孤儿文件」。

- **Rust 小工具**：`cargo run --bin check_file_owners`（需在 backend 目录且配置 `.env` 的 `DATABASE_URL`）
  - 列出所有用户（id、email），并标出磁盘路径中的 user_id（如 `e2e3520f-...`）
  - 查询指定 file_id（如 `7d4e5d64-...`、`fc134d71-...`）在 `files` 表中的记录：user_id、file_path、original_filename、created_at，并标注是否「与磁盘路径 user_id 一致」或「属其他账号」
  - 无记录时输出「无记录（孤儿文件）」
  - 统计该 user 在 `files` 表中的总条数
- **SQL 脚本**：`scripts/check_file_owners.sql`，可用 `psql $DATABASE_URL -f scripts/check_file_owners.sql` 执行；也可在任意客户端执行其中的 `SELECT` 查询。

修改/扩展：在 `src/bin/check_file_owners.rs` 中调整 `file_ids`、`storage_user_id`；在 `scripts/check_file_owners.sql` 中调整 `WHERE id IN (...)` 与 user_id 常量。

---

### 14) Tokio runtime 参数化（学习/压测调参入口）

你可以通过环境变量直接调 Tokio runtime（对高并发行为影响非常直观）：

- `TOKIO_WORKER_THREADS`
  - 默认：`available_parallelism()`（约等于 CPU 核心数）
  - 影响：异步任务的并行执行能力（CPU 密集型更明显）
- `TOKIO_MAX_BLOCKING_THREADS`
  - 默认：512
  - 影响：`tokio::fs` 等可能走 blocking 池的任务上限（磁盘 IO/压缩等场景更明显）

位置：`src/main.rs`

---

### 15) 上传链路磁盘保护 + 早期熔断（防磁盘/内存雪崩）

已落地：

- **普通上传**：在写入临时文件过程中实时累计 `file_size`，一旦超过 `config.max_file_size` 立刻停止并删除临时文件（避免继续读入/写盘）。
  - 位置：`src/handlers/files/upload.rs`（`upload_file_handler`）
- **分块写盘**：写 chunk 前 best-effort 检查 `temp_path` 所在盘剩余空间，保留 safety margin，空间不足直接返回错误。
  - 位置：`src/services/file/chunked_upload.rs`（`upload_chunk`）
- **分块合并**：合并前 best-effort 检查剩余空间是否足以容纳最终文件，避免合并到一半磁盘写满。
  - 位置：`src/services/file/chunked_upload.rs`（`complete_chunked_upload`）

依赖：

- `fs2::available_space`（跨平台获取可用磁盘空间）

---

### 16) 分块 uploaded_parts 原子更新（并发安全）

旧实现是“读 session → push part → sort → 整体写回数组”，高并发下可能出现丢更新。

已落地：

- 使用 SQL 原子追加：`array_append(uploaded_parts, $1)` 并加 `NOT ($1 = ANY(uploaded_parts))` 保护幂等
  - 位置：`src/repositories/upload_sessions.rs`（`UploadSessionsRepo::append_uploaded_part`）

---

### 17) 缩略图（Thumbnail）方案 B：先读盘再按需生成写盘（2026-02-07 备注）

**目标**：列表卡片用缩略图减轻加载，避免每次请求都在内存里解码/缩放/编码导致耗时长、内存峰值高；首次生成后落盘，后续请求直接读盘返回。

**已落地**：

- **接口**：`GET /api/files/:id/thumbnail?w=400`（仅 `image/*`，返回 JPEG 缩略图，`w` 默认 400、范围 64～800）。
- **方案 B 流程**：
  1. 先 `get_thumbnail(file_id)` 读已存在的缩略图；有则直接返回（快路径）。
  2. 无则读原图 → 在 **`tokio::task::spawn_blocking`** 中执行解码 → 缩略图 → 编码 JPEG（避免长时间占用 async 工作线程导致超时或无法正确返回）→ 写盘 `save_thumbnail` → 再返回同一份 JPEG。
- **存储（按用户隔离）**：
  - **Local**：`{base_path}/{user_id}/.thumbnails/{file_id}.jpg`
  - **S3**：key 为 `{user_id}/.thumbnails/{file_id}.jpg`
- **旧版兼容（已上传文件的缩略图）**：读缩略图时先查新路径，若无则查旧路径（Local：`{base_path}/.thumbnails/{file_id}.jpg`，S3：`.thumbnails/{file_id}.jpg`）；若在旧路径命中则复制到新路径并返回，并 best-effort 删除旧路径，实现「读时迁移」。发生迁移时会打一条 **info** 日志：`thumbnail migrated from legacy path/key to per-user path/key`，并带 `backend=local|s3`、`file_id`、`user_id`，便于排查与统计迁移次数。
- **删除联动**：单文件删除 / 批量删除时顺带 `delete_thumbnail(file_id, user_id)`（best-effort，忽略不存在）。
- **GIF**：仅解码第一帧（`gif` crate + `DecodeOptions::set_color_output(RGBA)`），大 GIF 不整文件解码，节省时间和内存。
- **多格式**：`image` 使用默认 feature，支持 jpeg/png/gif/webp/bmp/ico/tiff/tga/pnm 等；GIF 仍走独立第一帧逻辑。
- **编译修复**：`gif::Frame` 的 `width`/`height` 为字段，使用 `frame.width`、`frame.height`。

**涉及文件**：

- `Cargo.toml`：`image = "0.25"`（默认格式）、`gif = "0.13"`
- `src/utils/thumbnail.rs`：`decode_image_for_thumbnail`、`generate_thumbnail_jpeg`（供 `spawn_blocking` 调用）
- `src/services/storage.rs`：`get_thumbnail` / `save_thumbnail` / `delete_thumbnail`（Local + S3）
- `src/services/file/read.rs`：`get_thumbnail` / `save_thumbnail` / `delete_thumbnail` 转发
- `src/services/file/delete.rs`：删除文件后调用 `delete_thumbnail`
- `src/handlers/files/download/mod.rs`：`thumbnail_file_handler`（先读盘 → 无则 spawn_blocking 生成 → 写盘 → 返回）
- `src/api/files.rs`：路由 `GET /:id/thumbnail`

**前端**（同次改动）：列表 `LazyThumbnail` 使用 `fetchThumbnailBlob` 请求 `/thumbnail`；404/415 时返回 `null` 显示占位图标。

---

### 18) 超大视频 HLS 转码（>100MB 流式预览）

**目标**：对超过阈值的视频（默认 100MB）转成 HLS（`.m3u8` + `.ts`），前端用 hls.js 按段加载，省带宽、支持 seek、避免整文件进内存。

**已落地**：

- **配置**：`HLS_THRESHOLD_BYTES`（默认 104857600 = 100MB），超过则走 HLS；输出目录 `{storage_path}/.hls/{file_id}/`。
- **转码**：仅 **local 存储**；首次请求 `GET /api/files/:id/hls` 时若未生成则 `spawn_blocking` 调用 `ffmpeg -c copy -hls_time 6 -f hls` 生成 `playlist.m3u8` 与 `segment*.ts`，再返回 playlist；后续请求直接读盘。
- **路由**：`GET /api/files/:id/hls` 返回主列表；`GET /api/files/:id/hls/:filename` 返回分片（仅允许 `segment*.ts` / `playlist.m3u8`，防路径穿越）。
- **鉴权**：与预览一致，`AuthenticatedUserQuery`（query token 或 Authorization）。
- **删除联动**：单文件/批量删除时 `delete_hls(file_id)` 清理 `.hls/{file_id}/`。

**依赖**：服务器需安装 **ffmpeg**；S3 存储暂不支持（可扩展为先下载到临时路径再转码）。

**涉及文件**：

- `src/config.rs`：`hls_threshold_bytes`
- `src/services/file/hls.rs`：`ensure_hls_ready`、`delete_hls`、`should_use_hls`
- `src/services/file/delete.rs`：删除时调用 `delete_hls`
- `src/handlers/files/download/mod.rs`：`hls_playlist_handler`、`hls_asset_handler`
- `src/api/files.rs`：路由 `/:id/hls`、`/:id/hls/:filename`

**前端**：`file_size >= 100MB` 时请求 `getHlsUrl(id)`，用 hls.js 加载 m3u8；否则仍用直连 preview URL。

---

### 19) 分片上传 + 断点续传 与 秒传（文件指纹）

**目标**：大文件分块上传、记录进度、失败可单块重传；相同内容文件通过内容哈希（SHA-256）秒传，减少重复传输。

#### 分片上传 + 断点续传

- **流程**：
  1. `POST /upload/chunked/init`：提交 `filename`、`mime_type`、`total_size`，返回 `upload_id`、`chunk_size`（固定 2 MiB）、`total_parts`。
  2. `PUT /upload/chunked/:id/chunk?part=N`：按 part 从 1 到 total_parts 上传每块二进制；可乱序、可重传，已上传的 part 会幂等跳过。
  3. `GET /upload/chunked/:id/status`：返回 `uploaded_parts`、`total_parts`，前端据此做进度条并只传缺失块（断点续传）。
  4. `POST /upload/chunked/:id/complete`：服务端流式合并分块、校验大小、落库并清理临时文件。
  5. `DELETE /upload/chunked/:id/abort`：取消上传，删除会话与临时文件。

- **可选分块校验**：上传某块时请求头可带 `X-Part-SHA256: <该块内容的 SHA-256 十六进制>`；服务端校验通过才写入并记录该 part，不匹配返回 400。不传则兼容原有行为。

- **同时进行数量上限**：每用户同时进行的分片上传（未完成/未取消）不能超过 **10 个**（`MAX_CONCURRENT_CHUNKED_UPLOADS`），init 时若已达上限则返回 400。与前端约定：单次上传队列总文件数最多 **20**，其中大文件（≥100MB）最多 **10**（即最多 10 大 + 10 小）；前端**分开校验、分开提醒**（两行统计「文件数量 x/20」「大文件 y/10」及对应两条提示）。init 响应中返回 `max_concurrent_chunked_uploads` 供前端展示。
- **自动清理机制**：为了提升用户体验，当并发上传数达到上限时，后端在 init 新上传时会**自动清理该用户最旧的一个活跃会话**（删除临时目录及数据库记录），为新上传腾出槽位，尽量避免返回 400 错误。

- **完成时写入 content_sha256**：分片合并完成后对合并文件计算 SHA-256，写入 `files.content_sha256`，供秒传使用。

- **位置**：
  - `src/handlers/files/chunked_upload.rs`（init/chunk/status/complete/abort，chunk 时读取 `X-Part-SHA256`）
  - `src/services/file/chunked_upload.rs`（会话校验、分块落盘、块 SHA256 校验、流式合并、完成时算 SHA256）

#### 秒传（文件指纹）

- **接口**：`POST /upload/instant`  
  - 请求体：`content_sha256`（64 位十六进制）、`filename`、`file_size`、`mime_type`、`folder_id`（可选）。
  - 若存在同 `content_sha256` 且同 `file_size` 的任意一条文件记录：为当前用户新建一条文件记录，返回 201 与新建 file。
  - 若无：返回 **404**，前端应走普通上传或分片上传。

- **存储策略（修正后）**：
  - 若已有文件的路径属于**当前用户**：复用同一 `file_path`（节省存储）。
  - 若已有文件的路径属于**其他用户**：复制文件到当前用户目录，避免「DB `user_id` 与路径中的 `user_id` 不一致」。
  - **原因**：旧实现会复用任意已有文件的路径，导致新用户的记录指向其他用户的目录，造成数据不一致和删除时的混乱。

- **落库**：普通上传、分片完成时都会计算并写入 `content_sha256`，之后同内容文件即可秒传。

- **删除与引用**：
  - **同用户路径复用**：删除时先查「引用同一 `file_path` 的记录数」，仅当引用数为 0 时才删除物理文件（单文件删除与批量删除均已按此逻辑实现）。
  - **跨用户路径**：修正后不再出现，每个用户的文件都在自己的目录下。

- **位置**：
  - `src/handlers/files/instant_upload.rs`
  - `src/services/file/instant_upload.rs`
  - `src/services/file/delete.rs`（`count_by_file_path`，仅 ref_count==0 时删物理文件）
  - `src/repositories/files.rs`（`find_by_content_hash_and_size`、`count_by_file_path`）

#### 数据库与工具

- **迁移**：`012_add_content_sha256_to_files.sql`，为 `files` 增加 `content_sha256 VARCHAR(64) NULL` 及索引。
- **工具**：`src/utils/crypto.rs` 中 `sha256_hex(bytes)`、`sha256_file_hex(path)`（用于块校验与完成时整文件哈希）。

#### 前端实现（已接入）

- **秒传**：已实现。`fileService.uploadFileWithInstant(file, onProgress)` 为统一上传入口：先用 `utils/sha256.ts` 的 `sha256FileHex(file)`（Web Crypto）计算 SHA-256，再调 `POST /upload/instant`；201 则直接完成，404 则内部自动走普通上传或分片上传（按是否视频/超过分片阈值判断）。UploadDialog 与 useFileUpload 均调用此方法。
- **分片 + 断点续传**：init 后根据 status 的 `uploaded_parts` 只传未上传的 part（可带 `X-Part-SHA256` 做块校验），最后 complete。

**API 对接文档**：请求/响应格式与推荐流程见 `docs/UPLOAD_API.md`。

---

## 压测与观测建议（推荐后续补齐）

- **指标**：
  - DB：活跃连接数、等待事件、慢查询日志、锁等待
  - 应用：P95/P99 延迟、429/503 比例、内存 RSS、tokio blocking 线程池拥塞
- **压测方法**：
  - 分离压测：先单测列表，再单测上传，再混合压测（按真实比例）
  - 保持固定数据量（例如 10 万文件元数据）验证索引/分页策略

---

## 后续可继续写入的经验主题（占位）

- 更进一步的“按用户/按 token/按路径”的分层限流（进程内 + 网关层 + 多实例一致性）
- 上传临时文件清理策略（异常退出、磁盘空间阈值）
- 下载/预览更完善：Range 请求（断点续传）、ETag/If-None-Match、缓存控制
- 慢查询治理（索引、keyset pagination、ILIKE/全文检索策略）
