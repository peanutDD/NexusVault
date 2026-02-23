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
  - **视频循环播放**：视频预览默认开启循环播放，预览工具栏提供循环播放按钮（带图标与提示信息），可随时切换循环状态
  - **大视频 HLS 预览**：超过阈值（默认 100MB）的视频在后端转码为 HLS（.m3u8 + .ts），前端用 hls.js 流式播放
  - **Markdown 预览**：
    - 支持 `.md` / `.markdown` 文件以及 `text/markdown` / `text/x-markdown` MIME 类型
    - 使用 `react-markdown` + `remark-gfm` 渲染，支持 GitHub Flavored Markdown（表格、任务列表、删除线、自动链接等）
    - 代码语法高亮：通过 `rehype-highlight` 提供代码块语法高亮
    - HTML 图片支持：通过 `rehype-raw` 支持 Markdown 中的原生 HTML `<img>` 标签
    - 图片代理中转：自动将 Markdown 中的绝对 URL 图片（`http://` / `https://`）通过后端 `/api/proxy/image` 接口中转，绕过第三方防盗链限制
    - 主题切换：预览界面提供「深色 / 浅色」主题切换按钮，适配不同阅读偏好
    - 卡片标签：文件卡片上显示为 `md` 缩写，预览头部也显示 `md` 标识
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
- react-markdown + remark-gfm (Markdown 渲染)
- rehype-raw + rehype-highlight (HTML 支持与代码高亮)
- GitHub OAuth 登录（登录页「Sign in with GitHub」+ `/auth/callback/github` 回调，已接入）
- Google OAuth 登录（后端已实现 `/api/auth/oauth/google/*` 路由；前端登录页按钮已预留但默认禁用，待绑定公网域名后再开启）

### 后端
- Rust
- Axum (Web 框架)
- SQLx (数据库)
- PostgreSQL
- JWT 认证
- bcrypt (密码加密)
- reqwest (HTTP 客户端，用于图片代理与 GitHub OAuth)
- url (URL 解析与验证)
- urlencoding (安全编码 OAuth URL 参数与重定向 token)

## 快速开始

**🚀 立即开始：** 查看 [`docs/QUICK_START_GUIDE.md`](./docs/QUICK_START_GUIDE.md) 获取快速启动指南

**📋 设置完成总结：** 查看 [`docs/SETUP_COMPLETE.md`](./docs/SETUP_COMPLETE.md) 了解当前状态

详细步骤请参考 [`docs/QUICKSTART.md`](./docs/QUICKSTART.md)

**贡献与代码审查：** 提交 PR 前请阅读 [CONTRIBUTING.md](./CONTRIBUTING.md)；审查标准见 [docs/CODE_REVIEW_GUIDE.md](./docs/CODE_REVIEW_GUIDE.md)，首次使用见 [docs/CODE_REVIEW_START.md](./docs/CODE_REVIEW_START.md)。

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

> 🌐 **使用本地域名 `files.local`（可选，更稳定的本地开发方式）**  
> - 在开发机器上编辑 hosts（macOS 示例）：  
>   ```bash
>   sudo nano /etc/hosts
>   ```  
>   在文件末尾添加一行（将 `192.168.0.73` 换成你电脑在局域网中的实际 IP）：  
>   ```text
>   192.168.0.73  files.local
>   ```  
>   在 nano 中按 `Ctrl + O`（字母 O）保存，回车确认，再按 `Ctrl + X` 退出。  
>   可选：刷新本机 DNS 缓存（macOS 示例）：  
>   ```bash
>   sudo dscacheutil -flushcache
>   sudo killall -HUP mDNSResponder 2>/dev/null || true
>   ```  
>   然后在终端验证映射是否生效：  
>   ```bash
>   ping files.local
>   ```  
>   如果输出里的 IP 是你配置的地址（例如 `192.168.0.73`），说明 hosts 绑定成功。  
>   之后即可通过 `http://files.local:5173` 访问前端，通过 `http://files.local:3000` 访问后端。  
>  
> - 前后端推荐配置示例：  
>   - `frontend/.env`：  
>     ```env
>     VITE_API_BASE_URL=http://files.local:3000
>     ```  
>   - `backend/.env`：  
>     ```env
>     CORS_ORIGIN=http://localhost:5173,http://files.local:5173
>     GITHUB_OAUTH_REDIRECT_URI=http://files.local:3000/api/auth/oauth/github/callback
>     FRONTEND_BASE_URL=http://files.local:5173
>     ```  
>   - GitHub OAuth 应用中对应配置：  
>     - Homepage URL：`http://files.local:5173/`  
>     - Authorization callback URL：`http://files.local:3000/api/auth/oauth/github/callback`  
> - 注意：`files.local` 只在你配置了 hosts 的设备上可用，手机若想使用该域名访问，需要在手机上也做类似的 hosts/DNS 配置；否则手机可以直接用 IP 形式访问（如 `http://192.168.0.73:5173`）。

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
> - 首屏缩略图：按真实可视区域动态判定优先级，并预热首屏缩略图以降低 LCP  
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
  - 通过冷却时间、请求 ID 竞态检查、以及“仅向下滚动且哨兵从未进入→进入时触发”，避免上下回滚造成重复加载。  
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
- `GET /api/auth/oauth/github/url` - 获取 GitHub OAuth 授权 URL（前端点击「Sign in with GitHub」后跳转）
- `GET /api/auth/oauth/github/callback` - GitHub OAuth 回调，完成换取 access_token → 获取用户信息 → 从 `/user/emails` 中优先选择「primary + verified」邮箱（若不存在则退而求其次），据此在本地查找/创建用户 → 签发 JWT，并重定向回前端 `/auth/callback/github?token=...`
 - `GET /api/auth/oauth/google/url` - 获取 Google OAuth 授权 URL（后端已实现；受限于 Google 对回调域名的要求，目前仅在拥有公网域名或使用 ngrok/Cloudflare Tunnel 等方案时启用）
 - `GET /api/auth/oauth/google/callback` - Google OAuth 回调（后端已实现）：完成换取 access_token → 调用 OpenID Connect `userinfo` 接口获取 `sub`/`email`/`email_verified` 等信息，仅接受 `email_verified = true` 的邮箱；随后在本地查找/创建用户 → 签发 JWT，并重定向回前端 `/auth/callback/google?token=...`

> **GitHub 第三方登录行为说明**  
> - 邮箱选择规则：  
>   - 始终调用 `GET /user/emails`，按以下优先级选择邮箱：  
>     1. `primary && verified`  
>     2. 其余 `primary`  
>     3. 其余 `verified`  
>     4. 若列表仍为空，则回退到 `/user` 返回的 `email` 字段  
>   - 若最终仍无法获得邮箱，则登录失败并返回认证错误。  
> - 账号合并规则：  
>   - 若本地用户表中已存在同邮箱用户，则复用该用户（视为「用 GitHub 登录已有账号」），不会创建新账号；  
>   - 若不存在同邮箱用户，则以 GitHub 的 `name/login` 为提示生成唯一用户名，自动创建新用户。  
> - 日志可观测性（便于调试和审计）：  
>   - `github_oauth_callback: github_id=..., login=..., raw_email=..., selected_email=..., username_hint=...`  
>   - `oauth_login_existing_user: user_id=..., username=..., email=..., provider=github`  
>   - `oauth_login_new_user_created: user_id=..., username=..., email=..., provider=github`

> **Google 第三方登录完整方案（预留，待你有域名后启用）**  
> - 当前状态：  
>   - 后端已经实现 `GET /api/auth/oauth/google/url` 与 `GET /api/auth/oauth/google/callback`，并复用同一套 `AuthService::find_or_create_oauth_user` 逻辑；  
>   - 前端登录页已经放置「Sign in with Google」按钮，但默认设置为 `disabled`，防止在未配置好域名与 OAuth 应用时误点；  
>   - 前端路由层已经预留 `/auth/callback/google` 组件实现（参考 GitHub 回调组件的实现模式）。  
> - Google Console 端配置步骤（等你有自己的域名或使用 ngrok/Cloudflare Tunnel 之后再做）：  
>   1. 进入 Google Cloud Console，启用「OAuth 同意屏幕」，将应用发布为「测试中」或「上线」。  
>   2. 在「凭据」中创建 OAuth 2.0 Client（Web 应用），在 **Authorized JavaScript origins** 中填写你的前端域名（例如 `https://files.yourdomain.com` 或 `https://你的-ngrok-域名`）；  
>   3. 在 **Authorized redirect URIs** 中填写后端回调地址，例如 `https://files-api.yourdomain.com/api/auth/oauth/google/callback` 或 `https://你的-ngrok-域名/api/auth/oauth/google/callback`。  
> - 后端环境变量配置（`backend/.env`）：  
>   - `GOOGLE_CLIENT_ID=在 Google Console 创建的 OAuth Client ID`  
>   - `GOOGLE_CLIENT_SECRET=对应的 Client Secret`  
>   - `GOOGLE_OAUTH_REDIRECT_URI=https://你的后端域名或隧道域名/api/auth/oauth/google/callback`  
>   - `FRONTEND_BASE_URL=https://你的前端域名或隧道域名`（若已配置则无需修改，仅要求与实际前端一致）。  
> - 详细本地开发示例（等你需要时可以照着一步步做）：  
>   1. **打开 Google Cloud Console**  
>      - 浏览器访问：`https://console.cloud.google.com/apis/credentials`（可能要先选一个项目或新建项目）。  
>      - 如果没有项目：顶部项目下拉 → `New Project` → 随便起个名字 → 创建并切换到这个项目。  
>   2. **配置 OAuth 同意屏幕（只需要做一次）**  
>      - 左侧菜单：`APIs & Services` → `OAuth consent screen`。  
>      - 选择用户类型：自己用/测试阶段可以选 `External`（保持未发布即可）。  
>      - 填基础信息：  
>        - App name：例如 `Upload Download Util Local`；  
>        - User support email：选择你的 Google 账号邮箱；  
>        - Developer contact information：填你的邮箱；  
>      - 作用域（Scopes）可以先用默认；OpenID / email / profile 在后面创建凭据时会自动勾上。  
>   3. **创建 OAuth 2.0 Client ID（拿 Client ID / Secret）**  
>      - 左侧菜单：`APIs & Services` → `Credentials`；  
>      - 上方点击 `Create credentials` → `OAuth client ID`；  
>      - 选择类型：Application type = `Web application`；  
>      - 填写：  
>        - Name：随便取一个，比如 `Web Client (Local)`；  
>        - Authorized JavaScript origins（前端来源，Google 一般只接受 `http://localhost` 或 `https://` 的真实域名）：  
>          - 本机调试推荐填写：`http://localhost:5173`；  
>          - 若以后有公网域名或通过 ngrok / Cloudflare Tunnel 暴露前端，可填写例如：`https://files.yourdomain.com` 或 `https://你的-ngrok-域名`；  
>        - Authorized redirect URIs（**重点**）：  
>          - 必须和 `GOOGLE_OAUTH_REDIRECT_URI` 完全一致，例如：  
>            - 本机/局域网后端示例：`http://192.168.0.3:3000/api/auth/oauth/google/callback` 或 `http://files.local:3000/api/auth/oauth/google/callback`；  
>            - 线上/隧道示例：`https://files-api.yourdomain.com/api/auth/oauth/google/callback` 或 `https://你的-ngrok-域名/api/auth/oauth/google/callback`。  
>      - 点 `Create` 后，弹出的对话框里可以看到：  
>        - Client ID → 复制到 `GOOGLE_CLIENT_ID`；  
>        - Client secret → 复制到 `GOOGLE_CLIENT_SECRET`。  
>   4. **填到你的 `backend/.env` 并重启后端**  
>      - 例如（根据你是用 IP 还是 `files.local` 自己调整）：  
>        ```env
>        GOOGLE_CLIENT_ID=（刚才复制的 Client ID）
>        GOOGLE_CLIENT_SECRET=（刚才复制的 Client Secret）
>        GOOGLE_OAUTH_REDIRECT_URI=http://192.168.0.3:3000/api/auth/oauth/google/callback
>        ```  
>      - 确保这里的 `GOOGLE_OAUTH_REDIRECT_URI` 和你在 Google 控制台的 **Authorized redirect URIs** 里填的是同一条，否则会报 `redirect_uri_mismatch`。  
>      - 配置好后，重启后端（`cargo run`），前端通过 `/api/auth/oauth/google/url` 拿到的就是 Google 授权链接，可以正常跳转并回调到你的后端。  
> - 前端启用步骤：  
>   1. 打开登录页组件，找到「Sign in with Google (coming soon)」按钮，去掉 `disabled` 属性，并实现 `handleGoogleLogin`：调用 `GET /api/auth/oauth/google/url` 接口获取授权 URL 后 `window.location.href = url`；  
>   2. 确认前端路由中存在 `/auth/callback/google` 组件，逻辑与 GitHub 回调一致：从 URL 中取出 `token`，调用 `/api/auth/me` 获取用户信息，并通过 Zustand `useAuthStore().setAuth` 完成登录态写入后跳转到 `/files`；  
>   3. 在生产构建前，使用实际域名或隧道域名，在桌面与手机浏览器分别走完整登录流程，确保不会出现「invalid origin」或「redirect_uri mismatch」错误。  
> - 开启策略建议：  
>   - 你可以在真正有自己的域名或搭好 ngrok/Cloudflare Tunnel 后，再按照以上步骤逐项完成配置；  
>   - 当前阶段保留灰色不可点的 Google 按钮，相当于在 UI 和文档层先把「未来要做的事」标出，避免将来忘记接这条链路。

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
- `PUT /api/files/:id` - 重命名文件（body: `{ name: "new-name" }`）
- `DELETE /api/files/:id` - 删除文件
- 批量：`POST /api/files/batch-delete`、`POST /api/files/batch-move`、`GET /api/files/download-zip` 等

### 代理 API

- `GET /api/proxy/image?url=...` - 图片代理中转接口
  - 用于 Markdown 预览中的外链图片，绕过第三方防盗链限制
  - 仅支持 `http://` / `https://` 协议
  - 禁止访问 `localhost` / `127.0.0.1` / `::1`，防止 SSRF 攻击
  - 返回上游图片的原始 `Content-Type` 和字节流

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

# 可选：GitHub OAuth 登录
# GITHUB_CLIENT_ID=your-github-client-id
# GITHUB_CLIENT_SECRET=your-github-client-secret
# GITHUB_OAUTH_REDIRECT_URI=http://localhost:3000/api/auth/oauth/github/callback
#
# 可选：Google OAuth 登录（完整方案已实现，但受限于 Google 对回调域名的要求，建议在拥有公网域名或使用 ngrok/Cloudflare Tunnel 后再开启）
# GOOGLE_CLIENT_ID=your-google-client-id
# GOOGLE_CLIENT_SECRET=your-google-client-secret
# GOOGLE_OAUTH_REDIRECT_URI=https://your-domain-or-tunnel/api/auth/oauth/google/callback
#
# 前端回调后的跳转地址基于此构造：{FRONTEND_BASE_URL}/auth/callback/xxx
# FRONTEND_BASE_URL=http://localhost:5173
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
   - 密码复杂度：后端要求「长度 8–64，且至少包含 1 个字母和 1 个数字」
   - 支持邮箱 + 密码登录与 GitHub OAuth 登录，OAuth 登录使用随机 `state` + 内存缓存进行 CSRF 防护
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

若希望将本项目进一步打磨到「接近生产级 / 顶级工程水准」，推荐从以下几个方向分阶段演进（部分内容已在当前版本中落地，见每节下方的「当前状态」小结）：

- **阶段 1：工程基础（优先）**
  - 为后端关键路径（上传→列出→预览→下载）补充集成测试，用 `cargo test` 在 CI 中自动执行。
  - 为前端核心交互（文件列表过滤/搜索、上传校验）添加 Vitest + React Testing Library 测试。
  - 配置基础 CI（如 GitHub Actions），在每次提交时自动执行：前端 `lint/test/build`，后端 `cargo fmt --check`、`clippy` 和 `test`，确保 `main` 分支始终可随时部署。
  - **当前状态**：
    - 已为后端添加若干集成测试（如 `tests/repository_tests.rs`、`tests/auth_tests.rs`），并在 CI 中执行 `cargo test --all-features`。
    - 已为前端补充首批 Vitest 测试用例（如 `uploadValidation.test.ts`、`FileListFilters.test.tsx`），验证上传校验和搜索交互。
    - 已配置 GitHub Actions CI（`.github/workflows/ci.yml`），在 push/PR 时自动运行前后端的 lint/test/build 流水线。

- **阶段 2：存储与任务抽象**
  - 将当前文件读写封装为 `FileStorage` 抽象，提供「本地磁盘实现」与「S3/MinIO 实现」，便于后续迁移到对象存储与扩容。
  - 将 GIF 转 MP4、缩略图生成等长耗时操作抽象为「任务 + Worker」模式：Web API 只负责创建任务与查询状态，后台 Worker 异步消费任务并更新状态，避免阻塞请求线程。
  - **当前状态**：
    - 已存在 `StorageBackend` 抽象及 `LocalStorage` / S3 实现，文件上传、下载、缩略图等路径均通过统一接口访问。
    - 新增 `background_tasks` 表与 `TaskQueue` 服务，GIF→MP4 转码已改为通过任务队列 + Worker 异步执行，并通过 `/preview/video/prepare` + `/status` 提供前端轮询接口。
    - 将 GIF 预览转码逻辑封装在 `FileService::transcode_gif_to_mp4` 中，便于未来扩展缩略图重建等其他后台任务。
    - 新增 `/api/proxy/image` 图片代理接口，用于 Markdown 预览中的外链图片中转，包含基本的 SSRF 防护（禁止访问本地地址）。

- **阶段 3：前端设计系统与 UX 打磨**
  - 提炼通用 UI 组件（按钮、输入框、搜索框、对话框、标签/Badge 等），统一使用一套设计变量（颜色、圆角、阴影、字号），减少「每个页面单独写样式」的差异。
  - 对大文件列表引入虚拟滚动、键盘导航和更丰富的空状态/错误提示，使「大量文件时的浏览体验」更加顺滑且可预期。
  - **当前状态**：
    - 在 `src/components/common/` 下抽象了 `Button`、`EmptyState`、`ErrorMessage`、`Skeleton`、`Tag`、`FormField` 等通用组件，并在文件列表等核心界面（如空列表、错误态、加载态）中落地使用。
    - 文件预览模块新增 GIF 转码进度条、视频循环播放按钮等体验优化，提升 GIF/视频预览的一致性与可控性。
    - **Markdown 预览功能**：支持完整的 Markdown 渲染（包括 GFM 扩展、代码高亮、HTML 图片），提供深色/浅色主题切换，并通过后端代理接口解决外链图片防盗链问题。
    - 详细 UI 设计规范与组件用法已整理在 [`frontend/docs/UI_SYSTEM.md`](./frontend/docs/UI_SYSTEM.md) 中，作为前端开发的参考。

- **阶段 4：可观测性与安全**
  - 在现有结构化日志与 trace ID 基础上，进一步完善分布式追踪（如接入 OpenTelemetry / Jaeger），并将关键指标纳入统一告警面板。
  - 后续如有多用户/公网场景，可在此基础上完善鉴权（JWT/Session）、访问控制、限流与防护策略（如上传文件的类型/内容安全检查）。

以上各阶段可以按实际需求与时间投入逐步推进，不要求一次性完成；当前版本已基本完成阶段 1、阶段 2 的关键部分，并在阶段 3 上建立了统一的 UI 设计系统，为继续向「顶级水准」演进打下了良好基础。

## 走向商业化：改进清单（可逐项打勾）

> 本节用于规划「如果将本项目用于商业场景，还需要补齐哪些能力」。建议按优先级逐项推进，**实现一项就把对应条目标记为 `[x]`**，方便跟踪。

### 1. 账号体系与权限控制

- [x] **用户系统**
  - [x] 支持邮箱 + 密码注册/登录（后端 `AuthService` + `/api/auth/register` / `/api/auth/login`，前端表单 + JWT 持久化，所有文件相关接口通过 `Authorization: Bearer` 携带 user_id；后端当前密码规则为「长度 8–64，且至少包含 1 个字母和 1 个数字」，前端应在文案/校验中同步提示）
  - [ ] 可选接入第三方登录（**GitHub 已接入**：后端 `/api/auth/oauth/github/url` + `/api/auth/oauth/github/callback`，前端登录页「Sign in with GitHub」按钮 + `/auth/callback/github` 回调；**Google 登录后端与前端回调链路已实现，登录页按钮预留但默认禁用，等待你有正式域名/隧道域名后再开启**；其他企业 SSO 待接入）
  - [ ] 邮箱验证与找回密码流程（邮件 + 一次性 token + 过期时间）
  - [x] **多租户与权限（后端能力已实现）**
  - [x] 按用户/团队（Organization）隔离文件空间（后端已提供 `/api/org/*` 组织与成员管理接口，并支持将文件共享到组织空间；前端后续可在文件列表页增加「切换组织」与「团队文件视图」）
  - [x] 角色体系：Owner / Admin / Member，不同权限粒度（Owner/Admin 可管理成员与文件共享，Member 仅可访问与自身相关的组织及共享文件）
  - [ ] 文件/文件夹的分享范围控制（私有 / 组织内 / 公开链接）（当前实现为基础组织空间 + 成员角色，细粒度分享范围控制可在现有组织/分享模型上继续扩展）

### 2. 安全与合规

- [ ] **接口安全**
  - [ ] 所有写操作（上传、删除、移动、重命名等）统一走鉴权中间件
  - [ ] 针对敏感接口增加限流（按 IP / 用户），防止暴力请求与枚举 ID
  - [ ] 针对管理端接口增加额外保护（如仅允许特定来源网段或二次确认）
- [ ] **上传与内容安全**
  - [ ] 文件上传白名单：限制 MIME / 后缀组合，拒绝明显危险类型
  - [ ] 对 HTML / SVG 等潜在 XSS 载体统一加 `Content-Disposition: attachment` 或 `X-Content-Type-Options: nosniff`
  - [ ] 统一的病毒/恶意内容扫描接口预留（可对接第三方服务）
- [ ] **合规基础**
  - [ ] 提供隐私政策与使用条款页面（前端单独路由）
  - [ ] 用户注销账号时，完善数据删除流程（含对象存储中的文件）
  - [ ] 日志与备份的数据保留策略（保留时长、可溯源范围）

### 3. 可靠性与运维

- [ ] **错误监控**
  - [ ] 前端接入错误上报（如 Sentry），记录 JS 异常与接口失败
  - [ ] 后端 `tracing` 日志汇总到集中式日志系统（ELK / Loki 等）
  - [ ] 为关键业务路径设置告警阈值（错误率、延迟、磁盘/对象存储占用）
- [ ] **健康检查与自监控**
  - [ ] 提供 `/healthz` 接口，检查数据库、存储、队列等依赖的可用性
  - [ ] 暴露 `/metrics`（Prometheus）端点，输出 QPS、响应时间、错误率、任务队列长度等指标
- [ ] **后台任务与队列**
  - [ ] 将大文件转码、批量缩略图生成等操作统一通过任务队列（如 Redis）异步处理
  - [ ] 设计任务重试策略与死信队列，避免单次失败导致任务丢失或无限重试

### 4. 性能与成本优化

- [ ] **存储与 CDN**
  - [ ] 将文件本体迁移到对象存储（S3 / MinIO / OSS），前端访问走 CDN
  - [ ] 针对缩略图与预览接口，结合现有 HTTP 缓存头配置 CDN 规则，减少源站压力
  - [ ] Markdown 图片代理增加简单缓存层（本地文件或内存 LRU），避免同一外链反复回源
- [ ] **数据库与查询性能**
  - [ ] 为常用查询添加合适索引（按 `user_id`、`created_at`、`original_filename` 等）
  - [ ] 文件列表使用游标分页 / keyset 分页，避免深度 offset 带来的性能问题
- [ ] **前端性能**
  - [ ] 按路由/功能模块拆包，延迟加载管理后台、设置页等非首屏模块
  - [ ] 构建产物开启 gzip/brotli 压缩，并合理配置静态资源缓存策略

### 5. 产品功能补强

- [ ] **文件分享与协作**
  - [ ] 生成可配置的分享链接（过期时间、允许预览/下载、访问密码等）
  - [ ] 对分享链接的访问量与下载量进行统计，为后续商业分析提供数据基础
- [ ] **版本与审计**
  - [ ] 文件版本管理（至少保留最近 N 个版本，可回滚）
  - [ ] 审计日志：记录谁在何时对哪个文件做了什么操作（上传/删除/移动/分享）
- [ ] **搜索与组织**
  - [ ] 支持按文件名、类型、标签等组合搜索
  - [ ] 支持标签/分类管理界面，为商业用户提供更强的文件组织能力

### 6. 体验与 UI 打磨（商业版）

- [ ] **预览体验**
  - [ ] Markdown 预览支持目录（TOC）、锚点导航、图片点击放大/缩略图模式
  - [ ] 对失败的预览（视频/音频/文档）提供统一 fallback（错误原因 + 下载按钮）
- [ ] **操作反馈**
  - [ ] 统一的全局通知系统（成功/失败/警告），支持队列与自动消失
  - [ ] 对长耗时操作（批量上传、转码、压缩下载）提供进度反馈与可取消操作

### 7. 部署与环境管理

- [ ] **多环境配置**
  - [ ] 区分 `dev` / `staging` / `prod` 三套环境配置（数据库、对象存储、域名/回调地址）
  - [ ] 使用 `.env` + 配置管理工具集中管理敏感配置，不将密钥写入代码库
- [ ] **CI/CD**
  - [ ] 为主干分支设计自动化发布流程（push → 构建 → 部署到测试环境 → 人工确认后发布到生产）
  - [ ] 在发布流程中增加简单的 smoke test / health check，确保部署成功且服务可用

> 提示：上述条目既可以作为「Roadmap」，也可以作为「上线 checklist」。实际开发中可在每次完成某一改进后，将对应 `[ ]` 改为 `[x]`，并在提交信息中引用本节，方便团队追踪商业化进度。

## 许可证

Copyright © Mua2u Professional Services, LLC. All rights reserved.
