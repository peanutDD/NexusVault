# 文件上传下载系统

一个工业级的个人文件上传下载工具，前端使用 React 19 + TypeScript，后端使用 Rust + Axum。

## 功能特性

- ✅ 用户认证系统（JWT + API Token）
- ✅ 账户资料修改（用户名、邮箱；修改邮箱需验证码，SMTP 可选配置）
- ✅ 文件上传
  - 多文件、拖拽上传；支持 URL 拉取上传
  - **分片上传 + 断点续传**：大文件切块上传，记录进度，失败可重传单块；可选每块 `X-Part-SHA256` 校验
  - **秒传（文件指纹）**：客户端计算 SHA-256，服务器已有相同内容则直接创建记录、不传文件内容；若已有文件属于当前用户则复用路径，属于其他用户则复制到当前用户目录（确保路径一致性）；同用户多记录共享同一物理文件，删除时按引用计数仅最后一条删物理文件
  - 上传队列支持并行（大文件与小文件可同时上传），进度与「计算指纹…」「秒传未命中，正在上传…」等状态反馈
  - **文件类型白名单**：前后端统一校验，默认支持图片、视频、音频、PDF、文本、Office 文档（Word/Excel/PowerPoint）、OpenDocument、电子书（EPUB/MOBI）和常见压缩包（ZIP/7z/RAR/TAR/GZIP/BZIP2），避免无效格式污染
- ✅ 文件列表（虚拟列表 + 无限滚动，`Load more` 按钮兜底）
- ✅ 文件过滤与分组：
  - `By Type`：按类型分组（Images / Videos / Audio / Docs / Text / Archives / Others），每组支持独立全选
  - `By Time`：按天分组（例如 `Jan 24, 2025`），支持分组级全选
- ✅ 文件搜索（按名称模糊匹配）
- ✅ 文件下载 / 批量下载（ZIP 打包）
- ✅ 文件删除 / 批量删除（带确认弹窗）
- ✅ 混合存储支持（本地文件系统 + AWS S3）
- ✅ 文件预览
  - 图片 / PDF / 文本 / 音视频内联预览
  - **GIF 视频预览**：GIF 文件在后端按需转码为 MP4（通过后台任务异步生成），前端使用 `<video>` 元素播放，提供流畅的播放体验；首次打开 GIF 时若尚未完成转码，前端会调用 `prepare/status` 接口短暂轮询，转码完成后自动切换为视频播放
  - **大视频 HLS 预览**：超过阈值（默认 100MB）的视频在后端转码为 HLS（.m3u8 + .ts），前端用 hls.js 流式播放
  - 不支持的类型提供霓虹玻璃风格提示 + 下载按钮
- ✅ 文件夹与分类（新建文件夹、批量移动、分类筛选）
- ✅ 文件分享（分享链接、访问控制）
- ✅ 安全特性（文件类型验证、大小限制、路径清理）
- ✅ 响应式 UI 设计（桌面 / 移动端统一样式，包含下拉筛选与分组栏优化）

## 技术栈

### 前端
- React 19
- TypeScript
- Vite
- Tailwind CSS
- React Router
- Zustand (状态管理)
- Axios
- React Hook Form + Zod

### 后端
- Rust
- Axum (Web 框架)
- SQLx (数据库)
- PostgreSQL
- JWT 认证
- bcrypt (密码加密)

## 快速开始

**🚀 立即开始：** 查看 [`docs/QUICK_START_GUIDE.md`](./docs/QUICK_START_GUIDE.md) 获取快速启动指南

**📋 设置完成总结：** 查看 [`docs/SETUP_COMPLETE.md`](./docs/SETUP_COMPLETE.md) 了解当前状态

详细步骤请参考 [`docs/QUICKSTART.md`](./docs/QUICKSTART.md)

### 前置要求

- Rust (最新稳定版)
- Node.js 18+
- PostgreSQL 16+
- Docker (可选，用于运行 PostgreSQL)

### 1. 启动数据库

使用 Docker Compose：

```bash
docker-compose up -d
```

或手动启动 PostgreSQL 并创建数据库。

### 2. 配置后端

```bash
cd backend
cp .env.example .env
# 编辑 .env 文件，配置数据库连接和其他设置
```

### 3. 运行后端

```bash
cd backend
cargo run
```

后端将在 `http://localhost:3000` 启动。

### 4. 配置前端

```bash
cd frontend
cp .env.example .env
# 编辑 .env 文件，设置 API 基础 URL
```

创建 `.env` 文件：

```env
VITE_API_BASE_URL=http://localhost:3000
```

### 5. 运行前端（开发模式）

```bash
cd frontend
npm install
npm run dev
```

前端将在 `http://localhost:5173` 启动。

> 📱 **移动端访问（开发模式）**  
> - 确认后端 `backend` 监听在 `0.0.0.0:3000`（或通过反向代理暴露到局域网）  
> - 在 `frontend/.env.local` 中将 `VITE_API_BASE_URL` 设置为你电脑在局域网中的 IP，例如：  
>   ```env
>   VITE_API_BASE_URL=http://192.168.0.73:3000
>   ```  
> - 在手机浏览器中访问：`http://192.168.0.73:5173`（IP 请根据实际情况替换）

## 项目结构

### 顶层

```txt
upload-download-util/
├── backend/                # Rust 后端服务（Axum + SQLx）
├── frontend/               # React 19 + TypeScript 前端
├── docs/                   # 文档（快速开始 / 说明）
├── docker-compose.yml      # 本地 PostgreSQL / 依赖服务
└── README.md
```

### 后端结构（`backend/`）

```txt
backend/
├── src/
│   ├── api/                # 路由注册入口（按模块拆分，如 auth/files 等）
│   ├── handlers/           # 具体 Handler（文件 / 认证 / 健康检查等）
│   ├── models/             # 数据模型与数据库实体
│   ├── services/           # 业务服务（文件存储、共享链接、权限）
│   ├── middleware/         # 中间件（鉴权、日志、CORS 等）
│   ├── database/           # SQLx Pool 管理、迁移工具
│   ├── config.rs           # 配置加载（env + 默认值）
│   └── utils/              # 通用工具（错误处理、时间、ID 生成）
├── migrations/             # SQLx 数据库迁移
└── Cargo.toml
```

> **后端职责概览**  
> - 认证：注册 / 登录 / 用户信息、JWT 与 API Token  
> - 文件：普通上传、分片上传（断点续传）、秒传（content_sha256 去重）、下载、预览、HLS 转码（大视频）、删除（含引用计数）、分页列表、搜索与排序  
> - 存储：本地文件系统 + S3 的统一适配；秒传多记录共享同一物理文件  
> - 文件夹与分类、共享链接与访问控制  

### 前端结构（`frontend/`）

```txt
frontend/
├── src/
│   ├── components/
│   │   ├── files/              # 文件相关 UI（列表 / 网格 / 过滤 / 预览 等）
│   │   │   ├── list/           # FileList 主视图（过滤栏、分组、分页/无限滚动）
│   │   │   ├── grid/           # FileCard / FolderCard / FileGrid / VirtualizedFileGrid
│   │   │   ├── preview/        # FilePreview 模块（主组件 + Content/Toolbar/Icons + hooks）
│   │   │   ├── dialogs/        # 批量分享 / 批量移动 / 新建文件夹 / 重命名 对话框
│   │   │   └── upload/         # 上传对话框、上传队列、URL 上传表单
│   │   ├── common/             # 通用组件（按钮、对话框、DropdownMenu、表单控件等）
│   │   └── layout/             # 布局与导航（顶部导航栏 / 外层布局）
│   ├── pages/
│   │   ├── Files.tsx           # 文件管理主页面
│   │   ├── Login.tsx           # 登录页
│   │   ├── Register.tsx        # 注册页
│   │   └── Share.tsx           # 文件分享访问页面
│   ├── hooks/
│   │   ├── files/              # 文件过滤 / 选择 / 分组等业务 Hook（useFileFilters/useFileSelection 等）
│   │   └── useRequestDedup     # 请求去重 Hook（防止重复并发相同请求）
│   ├── services/               # API 封装（Auth / Files / Folders / Shares）
│   ├── store/                  # Zustand 状态（文件列表缓存 / 上传队列等）
│   ├── utils/                  # 工具函数（mime 类型、格式化、worker 池、文件列表缓存）
│   └── index.css               # 全局样式（导航栏、霓虹玻璃 UI、Tailwind 覆盖）
├── public/                     # 静态资源
└── package.json
```

> **前端职责概览**  
> - `useFileList`：集中处理列表数据获取、过滤、排序、分页、选择状态  
> - 分组模式：  
>   - **By Type**：按类型分组（Images / Videos / Audio / Docs / Text / Archives / Others），每组带独立「全选」  
>   - **By Time**：按「天」分组，例如 `Jan 24, 2025`，支持分组级「全选」  
> - 列表性能：虚拟网格 + 无限滚动 + `Load more` 按钮兜底  
> - 预览体验：支持常见文件类型内联预览；不支持的类型使用霓虹玻璃风提示框 + 下载按钮  
> - 响应式：桌面 / 移动端统一使用同一套过滤栏、分组栏与下拉菜单视觉风格

### 前端 UI 设计系统

前端在 `src/components/common/` 下抽象了一套可复用的 UI 组件，用于统一按钮、空状态、错误提示和加载态的视觉与交互：

- **按钮 `Button`**：用于对话框确认、列表工具栏、操作入口等，统一圆角、阴影和 hover/focus 状态。
- **空状态 `EmptyState`**：用于「暂无文件 / 文件夹为空 / 搜索无结果」等场景，例如当前文件列表在 `totalItems === 0` 时即使用该组件。
- **错误提示 `ErrorMessage`**：玻璃拟态风的错误/警告/信息提示，用于列表加载失败、预览错误等场景，可配合 `Button` 提供「重试」操作。
- **骨架屏 `Skeleton` / `FileCardSkeleton` / `FileListSkeleton`**：用于文件列表和网格的加载占位，减少大列表加载时的视觉跳变。
- **标签 `Tag` 与表单容器 `FormField`**：统一展示状态徽标、表单标签与说明文字，用于设置页、对话框等。

更详细的前端 UI 设计规范与示例代码，见 [`frontend/docs/UI_SYSTEM.md`](./frontend/docs/UI_SYSTEM.md)。

## 高并发与性能设计

本项目在前后端都针对高并发 / 大文件量场景做了专门的设计。下面是实际用到的关键技术与策略。

### 后端高并发能力（Rust + Axum + SQLx）

- **异步运行时：Tokio**  
  - 所有 HTTP Handler 基于 async/await，依托 Tokio 事件循环，单进程即可处理大量并发连接。  
- **连接池与零拷贝 I/O**  
  - SQLx 内置连接池，复用数据库连接，避免在高并发下频繁创建/销毁连接。  
  - 文件上传 / 下载使用 Rust 标准库与 Tokio I/O 组合，尽量以流式方式读写，减小内存占用峰值。  
- **分层架构解耦**  
  - `handlers/` 只负责 HTTP 解析与入参校验；  
  - `services/` 内部封装核心业务（如批量删除、文件共享、权限判断），便于在未来增加队列或任务系统时扩展。  
- **存储后端抽象**  
  - 通过配置切换本地文件系统与 S3，接口统一，便于在高并发下迁移到更高吞吐的对象存储。  
- **安全与限流基础**  
  - 通过环境变量控制单文件大小 `MAX_FILE_SIZE` 与 MIME 白名单；  
  - 预留了在中间件层增加限流、速率限制的入口（如基于 IP / 用户维度）。

### 前端高并发与大列表能力（React 19 + Zustand）

- **请求去重与并发控制**  
  - `useRequestDedup` 基于 `REQUEST` 常量（`REQUEST.DEDUP_TTL_MS` / `REQUEST.DEDUP_MAX_CACHE_SIZE`），  
    对相同参数的请求在短时间内复用结果，避免多次点击 / 滚动触发重复请求。  
  - 请求层面的并发上限由 `REQUEST.LIMITER_MAX_CONCURRENT` 控制，可按需收紧。
- **文件列表缓存（stale-while-revalidate）**  
  - `useFileList` + `utils/fileListCache`：  
    - 第一页及后续分页结果会缓存在 `localStorage` 中（LRU 替换，数量由 `FILE_LIST.CACHE_MAX_ENTRIES` 控制）。  
    - 命中缓存时立即渲染，再在后台静默刷新，既保证首次渲染速度，又能尽量保持数据新鲜。  
- **分页与无限滚动结合**  
  - `FILE_LIST.LIMIT` 控制单页返回量（默认为 60），降低单次渲染压力。  
  - `InfiniteScrollSentinel` + `loadMore`：滑动到底部自动加载下一页，  
    同时提供 `Load more` 按钮兜底（防止某些环境下 IntersectionObserver 不稳定）。  
  - 通过冷却时间与请求 ID 竞态检查，避免频繁触底导致的「并发 loadMore 洪泛」。
- **虚拟列表与分组 Worker**  
  - 当文件数量超过 `FILE_LIST.VIRTUAL_THRESHOLD` 时，自动切换为 `VirtualizedFileGrid`，  
    仅渲染可视区域的网格行，显著降低大列表滚动成本。  
  - 类型分组逻辑在 `useFileGroupingWithIcons` 中使用 `groupFilesInWorker`（Web Worker 池），  
    将「按类型聚合 + 排序」这类 O(n) 计算从主线程剥离出来，保持交互流畅。
- **过滤 / 排序防抖与状态集中管理**  
  - `useFileFilters` 对搜索输入做防抖，避免每个字符都触发一次网络请求与重渲染。  
  - `useFileList` 统一维护 `files / total / loadedPageCount / selection` 等状态，  
    结合 Zustand store（如 `fileStore` / `files/listStore`）做缓存与派发，减少多处组件重复计算。

> 总体上：后端依靠 Rust + Axum + SQLx + Tokio 提供高并发处理能力；  
> 前端则通过请求去重、缓存、虚拟列表与 Worker 分组，确保在大量文件与频繁操作下仍然保持良好的响应速度。

## 运维与可观测性

### 结构化日志与 Trace ID

- **请求级日志**：  
  - 通过 `RequestLogLayer` 中间件为每个 HTTP 请求打出结构化日志，包括：  
    - `trace_id`, `user_id`, `method`, `path`, `status`, `latency_ms`  
  - 若上游（网关 / 反向代理）已注入 `X-Trace-Id` / `X-Request-Id`，则复用；否则服务端生成 UUID。  
  - 响应统一回写 `X-Trace-Id` / `X-Request-Id`，前端可在错误上报中带上，方便端到端排查。
- **统一错误处理**：  
  - 所有业务错误收敛为 `AppError`，在 `IntoResponse` 中根据错误类型映射到合适的 HTTP 状态码与脱敏后的用户消息，  
  - 日志中带上 `error_id`、`error_type`、`timestamp`，便于从告警跳转到详细日志。

### 指标与简单监控

- **HTTP 维度指标（Prometheus 兼容）**：  
  - 通过 `metrics_middleware` 记录：  
    - `http_requests_total{method,path,status,status_class}`  
    - `http_request_duration_seconds{method,path}`（直方图，可用于 P95/P99 延迟）  
    - `http_requests_in_flight`（在途请求数）
- **文件上传/下载指标**：  
  - 使用 `record_file_operation("upload"|"download", size_bytes, success)` 记录：  
    - `file_operations_total{operation,status}`：上传/下载成功与失败次数  
    - `file_operation_size_bytes{operation}`：成功上传/下载的文件大小分布（直方图）  
  - 可据此统计一段时间内的上传/下载流量与平均文件大小。
- **转码任务指标（GIF → MP4 预览）**：  
  - 后台 GIF 预览 Worker 在每次转码完成后上报：  
    - `transcode_jobs_total{task_type="gif_preview",status="succeeded|failed"}`  
    - `transcode_duration_seconds{task_type="gif_preview"}`  
  - 日志中额外包含 `task_id`, `user_id`, `file_id`, `duration_ms`，便于排查个别任务异常。

### 关键错误与日志告警

- **磁盘空间不足**：  
  - 普通上传前会检查临时目录可用空间，若预留空间不足，则：  
    - 记录结构化错误日志：`error_type="disk_full", tmp_dir, free_bytes, reserve_bytes`  
    - 返回用户可读的错误信息「磁盘空间不足，请稍后重试」。  
  - 运维可基于 `error_type="disk_full"` 在日志系统或告警平台（如 Loki + Alertmanager / ELK + Watcher）上配置告警。
- **对象存储失败（本地磁盘 / S3）**：  
  - 所有存储相关错误统一映射为 `AppError::Storage` 或 `AppError::File`，在错误处理中记录：  
    - `error_type="storage"` / `"file"` 与脱敏后的错误细节（不包含完整路径）。  
  - 运维可按错误类型与出现频率设置告警，如「5 分钟内 STORAGE_ERROR 超过 N 次」。

### 前端遥测与错误上报

- **前端事件上报接口**：  
  - 新增 `POST /api/telemetry/events`，接受来自前端的关键交互与错误事件：  
    - 字段包括：`event_type`, `action`, `status`, `duration_ms`, `error_message`, `file_id`, `file_size`, `extra` 等  
    - 通过 `AuthenticatedUser` 提取 `user_id`，在后端以 `target="frontend_telemetry"` 的结构化日志记录。
- **内置埋点与错误上报**：  
  - 上传：  
    - 批量上传开始时上报 `upload_batch_start` 事件（带文件数量与总大小）；  
    - 单文件「秒传 + 普通/分片上传」封装为 `upload_with_instant` 事件，记录成功/失败与耗时。  
  - 下载：  
    - 调用下载接口前后分别上报 `download_file` 的 `start` / `success` 事件（含 `file_id` 与耗时）。  
  - 错误：  
    - `ErrorBoundary` 捕获到的 React 渲染错误会通过 `trackError` 上报，包含组件栈信息；  
    - 全局 `window.error` 与 `unhandledrejection` 监听，将未捕获的 JS 错误与 Promise 拒绝上报到 `/api/telemetry/events`。  

> 通过上述日志 + 指标 + 遥测事件组合，你可以在不引入全套监控系统的前提下，  
> 先从日志聚合与基础告警做起：  
> - 统计转码任务量与失败率  
> - 统计上传/下载 QPS 与平均/分位时延  
> - 对「磁盘满」「存储错误」「高失败率」等关键事件快速告警。

## API 端点

### 认证 API

- `POST /api/auth/register` - 用户注册
- `POST /api/auth/login` - 用户登录
- `GET /api/auth/me` - 获取当前用户信息
- `PUT /api/auth/update-profile` - 更新用户名/邮箱（修改邮箱需先获取验证码）
- `POST /api/auth/send-email-verification` - 发送邮箱验证码

### 文件 API

- `GET /api/files` - 获取文件列表（支持分页、搜索、分类、文件夹）
- `POST /api/files/upload` - 普通上传（单文件 multipart）
- `POST /api/files/upload/instant` - 秒传（提交 content_sha256 + filename + file_size + mime_type；已有则 201 返回 file，无则 200 返回 `{ "instant": false }`，客户端走普通/分片上传）
- `POST /api/files/upload/chunked/init` - 初始化分片上传
- `PUT /api/files/upload/chunked/:id/chunk` - 上传分片（可选请求头 `X-Part-SHA256` 校验）
- `GET /api/files/upload/chunked/:id/status` - 查询已上传分片（断点续传用）
- `POST /api/files/upload/chunked/:id/complete` - 完成分片上传
- `DELETE /api/files/upload/chunked/:id/abort` - 取消分片上传
- `GET /api/files/:id/download` - 下载文件
- `GET /api/files/:id/preview` - 预览（流式/内联）
- `GET /api/files/:id/preview/video` - GIF 视频预览：若派生 mp4 已存在，直接以流的形式返回，供 `<video>` 播放；若尚未生成则返回 404，由前端根据 `prepare/status` 决定 UI
- `POST /api/files/:id/preview/video/prepare` - 触发或复用 GIF 视频预览转码后台任务：若已存在派生 mp4 则返回 `{ status: "ready" }`，否则写入 `background_tasks` 队列表并返回 `{ status: "processing" }`
- `GET /api/files/:id/preview/video/status` - 查询 GIF 视频预览转码状态（前端轮询使用）：仅根据派生 mp4 是否存在返回 `{ status: "ready" }` 或 `{ status: "processing" }`
- `GET /api/files/:id/hls` - 大视频 HLS 主列表（.m3u8）
- `GET /api/files/:id/hls/:filename` - HLS 分片（.ts）
- `GET /api/files/:id/thumbnail` - 缩略图
- `DELETE /api/files/:id` - 删除文件
- 批量：`POST /api/files/batch-delete`、`POST /api/files/batch-move`、`GET /api/files/download-zip` 等

## 环境变量

### 后端 (.env)

```env
DATABASE_URL=postgresql://user:password@localhost:5432/file_storage
JWT_SECRET=your-secret-key
JWT_EXPIRY=24h
STORAGE_BACKEND=local
STORAGE_PATH=./uploads
MAX_FILE_SIZE=2147483648
# 允许上传的 MIME 类型（前后端默认值一致）
# 默认支持：图片、视频、音频、PDF、文本、Office 文档、OpenDocument、电子书、压缩包
# 如需自定义，可覆盖此值（前后端需保持一致）
ALLOWED_MIME_TYPES=image/*,video/*,audio/*,application/pdf,text/*,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.oasis.opendocument.text,application/vnd.oasis.opendocument.spreadsheet,application/vnd.oasis.opendocument.presentation,application/epub+zip,application/x-mobipocket-ebook,application/zip,application/x-7z-compressed,application/x-rar-compressed,application/x-tar,application/gzip,application/x-bzip2
PORT=3000
CORS_ORIGIN=*

# 可选：大视频超过此大小（字节）时生成 HLS 供前端流式预览，默认 104857600（100MB）
# HLS_THRESHOLD_BYTES=104857600

# 可选：SMTP（修改邮箱验证码；不配置则验证码仅写入日志）
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_USERNAME=your@gmail.com
# SMTP_PASSWORD=应用专用密码
# SMTP_FROM=your@gmail.com
```

### 前端 (.env)

```env
VITE_API_BASE_URL=http://localhost:3000

# 可选：允许上传的 MIME 类型（需与后端 ALLOWED_MIME_TYPES 保持一致）
# 默认值已包含：图片、视频、音频、PDF、文本、Office 文档、OpenDocument、电子书、压缩包
# VITE_ALLOWED_MIME_TYPES=image/*,video/*,audio/*,application/pdf,text/*,...
```

## 安全特性

1. **认证安全**
   - 密码使用 bcrypt 加密
   - JWT Token 认证
   - Token 过期机制

2. **文件安全**
   - **文件类型白名单验证**：前后端统一校验，默认支持以下类型：
     - **基础类型**：图片（`image/*`）、视频（`video/*`）、音频（`audio/*`）、PDF（`application/pdf`）、文本（`text/*`）
     - **Office 文档**：Word（`.doc`, `.docx`）、Excel（`.xls`, `.xlsx`）、PowerPoint（`.ppt`, `.pptx`）
     - **OpenDocument**：`.odt`, `.ods`, `.odp`
     - **电子书**：`.epub`, `.mobi`
     - **压缩包**：`.zip`, `.7z`, `.rar`, `.tar`, `.gz`, `.bz2`
     - 不在白名单内的文件类型会被前端直接拦截，不会进入上传队列
   - 文件大小限制（默认 2GB，可通过 `MAX_FILE_SIZE` 配置）
   - 文件名清理（防止路径遍历攻击）

3. **API 安全**
   - CORS 配置
   - 请求超时限制
   - 输入验证

## 开发

### 后端开发

```bash
cd backend
cargo run
```

### 前端开发

```bash
cd frontend
npm run dev
```

### 数据库迁移

迁移会在后端启动时自动运行。

## 构建生产版本

### 后端

```bash
cd backend
cargo build --release
```

### 前端

```bash
cd frontend
npm run build
```

构建产物在 `frontend/dist` 目录。

#### 本地预览生产构建

```bash
cd frontend
npm run build
npm run preview -- --host 0.0.0.0 --port 5173
```

- 在桌面浏览器访问：`http://localhost:5173`
- 在手机浏览器访问：`http://<你的局域网 IP>:5173`

> 生产预览模式下，前端会以实际打包后的代码运行，更接近线上表现（包括列表渲染性能与 hover 效果）。

## CDN 与公网访问

### 有域名时：整站加速（CDN）

若你有公网域名，希望整站走 CDN 加速、并顺带做 DDoS 防护，推荐使用 **Cloudflare**（免费）：

1. 在 [Cloudflare](https://dash.cloudflare.com) 添加站点，将域名的 **NS 记录** 改到 Cloudflare 提供的 NS。
2. 在 **DNS → Records** 中把域名 A/CNAME 指到你的服务器，并开启 **Proxied**（橙色云朵），流量即经 Cloudflare 再回源。
3. 可选：**Caching → Caching Rules** 为 `/assets/` 或 `.js`/`.css`/图片等静态资源设置缓存，提升首屏与资源加载速度。
4. **SSL/TLS** 选 **Full** 或 **Full (strict)**（源站已启用 HTTPS 时用 strict）。

前后端分离时：前端可部署到 **Vercel** 或 **Cloudflare Pages**（自带 CDN），API 使用子域（如 `api.xxx.com`）并同样接入 Cloudflare 做加速与防护。

若使用**独立 CDN 子域**承载静态资源（例如 `cdn.mmba.stream`）：在 Cloudflare **DNS → Records** 中为该子域添加记录（如 CNAME 到主站或静态源），并开启 **Proxied**；在 **Caching Rules** 中对该域名或路径设置较长缓存，静态资源即可通过该 CDN 域名加速。

### 无域名、仅本地时

- **不需要 CDN**：访问地址为 `http://localhost:5173` 或 `http://192.168.x.x:5173` 时，流量只在局域网内，没有公网节点可加速，当前方式已足够快。
- **若希望从外网访问、又暂时没有域名**：可使用内网穿透，由服务商提供临时公网地址，无需购买域名或公网 IP：
  - **Cloudflare Tunnel**：安装 [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/)，运行后可获得 `xxx.trycloudflare.com` 等临时 URL。
  - **ngrok**：安装 [ngrok](https://ngrok.com)，运行后获得 `xxx.ngrok.io` 等临时 URL（免费版有并发与时长限制）。

## 架构评估与后续优化方向

从整体架构和工程实践角度看，本项目已具备一个「中高完成度个人/小团队文件服务」应有的功能与质量：

- **功能维度**：支持大文件上传（含分片）、下载、GIF 转 MP4 预览、缩略图懒加载与缓存、详细的上传类型白名单、安全相关配置（环境变量）、以及较完善的文档（包括 Ugoira 功能的历史说明）。
- **技术栈维度**：后端基于 **Rust / Axum / SQLx / Tokio**，前端基于 **React / Vite / TypeScript**，再配合 Tailwind 风格的工具类与 Bootstrap Icons，整体选型主流且健康，没有明显的技术路线问题。

若希望将本项目进一步打磨到「接近生产级 / 顶级工程水准」，推荐从以下几个方向分阶段演进：

- **阶段 1：工程基础（优先）**
  - 为后端关键路径（上传→列出→预览→下载）补充集成测试，用 `cargo test` 在 CI 中自动执行。
  - 为前端核心交互（文件列表过滤/搜索、上传校验）添加 Vitest + React Testing Library 测试。
  - 配置基础 CI（如 GitHub Actions），在每次提交时自动执行：前端 `lint/test/build`，后端 `cargo fmt --check`、`clippy` 和 `test`，确保 `main` 分支始终可随时部署。

- **阶段 2：存储与任务抽象**
  - 将当前文件读写封装为 `FileStorage` 抽象，提供「本地磁盘实现」与「S3/MinIO 实现」，便于后续迁移到对象存储与扩容。
  - 将 GIF 转 MP4、缩略图生成等长耗时操作抽象为「任务 + Worker」模式：Web API 只负责创建任务与查询状态，后台 Worker 异步消费任务并更新状态，避免阻塞请求线程。

- **阶段 3：前端设计系统与 UX 打磨**
  - 提炼通用 UI 组件（按钮、输入框、搜索框、对话框、标签/Badge 等），统一使用一套设计变量（颜色、圆角、阴影、字号），减少「每个页面单独写样式」的差异。
  - 对大文件列表引入虚拟滚动、键盘导航和更丰富的空状态/错误提示，使「大量文件时的浏览体验」更加顺滑且可预期。

- **阶段 4：可观测性与安全**
  - 在现有结构化日志与 trace ID 基础上，进一步完善分布式追踪（如接入 OpenTelemetry / Jaeger），并将关键指标纳入统一告警面板。
  - 后续如有多用户/公网场景，可在此基础上完善鉴权（JWT/Session）、访问控制、限流与防护策略（如上传文件的类型/内容安全检查）。

以上各阶段可以按实际需求与时间投入逐步推进，不要求一次性完成；即使只落地「阶段 1 + 阶段 2 的部分内容」，项目的整体工程质量和可维护性也会有明显提升。

## 许可证

Copyright © Mua2u Professional Services, LLC. All rights reserved.
