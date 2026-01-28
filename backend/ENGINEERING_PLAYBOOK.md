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

### 1) 路由级并发限制（快速背压）

对热点端点加了 **ConcurrencyLimit + LoadShed**，过载时返回 **503**（`SERVICE_OVERLOADED`），避免：

- DB 连接池排队导致任务堆积、内存上涨
- 文件 IO/CPU 被瞬间打满导致全站雪崩

位置：`src/api/files.rs`

- **列表**：`LIST_CONCURRENCY`
- **普通上传**：`UPLOAD_CONCURRENCY`
- **分块上传 chunk**：`CHUNK_CONCURRENCY`
- **分块完成合并**：`COMPLETE_CONCURRENCY`

> 调参建议：在单机 10 核、`max_connections=20` 的前提下，先保持“保守值”，压测稳定后再逐步上调并观察 P95/P99 延迟和错误率。

---

### 2) 普通上传改为流式落盘（避免 OOM）

之前实现会把 multipart 文件字段一次性读入 `Vec<u8>`，高并发下容易造成：
\(并发数 \times 文件大小\) 级别内存峰值 → OOM/抖动。

现在改为：

- 读取 multipart 的 `chunk()`，边读边写到临时文件
- 再通过存储层的 `save_file_from_path` 保存到最终存储（Local/S3）

位置：`src/handlers/files.rs`

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

位置：`src/services/file.rs`（`complete_chunked_upload`）

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

位置：`src/services/file.rs`（`list_files`）

备注：

- 当结果为空时 `total_count` 不存在，逻辑返回 `total=0`（符合预期）。

---

### 6) 连接池“更快失败” + SQL 超时（防慢查询雪崩）

连接池从“长时间等待”调整为“更快失败”，避免大量请求挂起排队：

- `acquire_timeout` 从 30s 降到 5s

并且在 `after_connect` 设置：

- `SET statement_timeout = '20s'`

位置：`src/database/pool.rs`

调参建议：

- 列表通常应更短（如 2–5s），写入可略长（如 5–10s），建议按接口粒度做 `SET LOCAL statement_timeout=...`（在事务/单请求作用域内）。

已落地：

- 列表接口在事务内执行 `SET LOCAL statement_timeout = '3s'`（避免把配置污染到连接池的其它请求）
  - 位置：`src/services/file.rs`（`list_files`）

---

### 7) 下载/预览改为流式响应（避免下载时 OOM）

之前下载/预览通过 `get_file()` 读入 `Vec<u8>`，大文件 + 高并发下载时会产生巨大的内存峰值。

现在改为：

- `StorageBackend::open_read_stream` 统一返回可流式读取的源（Local 文件 / S3 ByteStream）
- handler 使用 `Body::from_stream(...)` 直接把数据“边读边发”
- `stream_file_response(...)` 统一设置 `Content-Type/Disposition/Length`

位置：

- `src/services/storage.rs`（`StorageReadStream` / `open_read_stream`）
- `src/services/file.rs`（`open_file_stream`）
- `src/handlers/files.rs`（`download_file_handler` / `preview_file_handler`）
- `src/utils/response.rs`（`stream_file_response`）

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
- `src/services/file.rs`（`open_file_stream_range`）
- `src/handlers/files.rs`（`download_file_handler` / `preview_file_handler`）

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

- `src/handlers/files.rs`（`chunked_upload_chunk_handler`）
- `src/services/file.rs`（`upload_chunk`）

---

### 11) 避免“孤儿文件”（存储写入成功但落库失败）

高并发/异常场景下，可能出现：

- 文件已写入存储（本地磁盘/S3）
- 但 DB `INSERT files ...` 失败（连接超时、statement_timeout、临时故障等）

如果不处理，会产生“孤儿文件”长期占用存储空间。

已落地：

- `create_file` / `create_file_from_path` 在落库失败时 best-effort 执行 `storage.delete_file(file_path)` 清理。
  - 位置：`src/services/file.rs`

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
  - 位置：`src/handlers/files.rs`（`upload_file_handler`）
- **分块写盘**：写 chunk 前 best-effort 检查 `temp_path` 所在盘剩余空间，保留 safety margin，空间不足直接返回错误。
  - 位置：`src/services/file.rs`（`upload_chunk`）
- **分块合并**：合并前 best-effort 检查剩余空间是否足以容纳最终文件，避免合并到一半磁盘写满。
  - 位置：`src/services/file.rs`（`complete_chunked_upload`）

依赖：

- `fs2::available_space`（跨平台获取可用磁盘空间）

---

### 16) 分块 uploaded_parts 原子更新（并发安全）

旧实现是“读 session → push part → sort → 整体写回数组”，高并发下可能出现丢更新。

已落地：

- 使用 SQL 原子追加：`array_append(uploaded_parts, $1)` 并加 `NOT ($1 = ANY(uploaded_parts))` 保护幂等
  - 位置：`src/services/file.rs`（`upload_chunk`）

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

