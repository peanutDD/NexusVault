# 文件上传下载系统

一个工业级的个人文件上传下载工具，前端使用 React 19 + TypeScript，后端使用 Rust + Axum。

## 功能特性

- ✅ 用户认证系统（JWT + API Token）
- ✅ 文件上传
  - 多文件、拖拽上传；支持 URL 拉取上传
  - **分片上传 + 断点续传**：大文件切块上传，记录进度，失败可重传单块；可选每块 `X-Part-SHA256` 校验
  - **秒传（文件指纹）**：客户端计算 SHA-256，服务器已有相同内容则直接创建记录、不传文件内容；多记录共享同一物理文件，删除时按引用计数仅最后一条删物理文件
  - 上传队列支持并行（大文件与小文件可同时上传），进度与「计算指纹…」「秒传未命中，正在上传…」等状态反馈
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
│   │   │   ├── preview/        # FilePreview（图片/视频/音频/文本预览、不支持类型提示框）
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

## API 端点

### 认证 API

- `POST /api/auth/register` - 用户注册
- `POST /api/auth/login` - 用户登录
- `GET /api/auth/me` - 获取当前用户信息

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
MAX_FILE_SIZE=104857600
ALLOWED_MIME_TYPES=image/*,application/pdf,text/*
PORT=3000
CORS_ORIGIN=*

# 可选：大视频超过此大小（字节）时生成 HLS 供前端流式预览，默认 104857600（100MB）
# HLS_THRESHOLD_BYTES=104857600
```

### 前端 (.env)

```env
VITE_API_BASE_URL=http://localhost:3000
```

## 安全特性

1. **认证安全**
   - 密码使用 bcrypt 加密
   - JWT Token 认证
   - Token 过期机制

2. **文件安全**
   - 文件类型白名单验证
   - 文件大小限制
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

## 许可证

Copyright © Mua2u Professional Services, LLC. All rights reserved.
