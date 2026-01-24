# 文件上传下载系统

一个工业级的个人文件上传下载工具，前端使用 React 19 + TypeScript，后端使用 Rust + Axum。

## 功能特性

- ✅ 用户认证系统（JWT）
- ✅ 文件上传（支持多文件、拖拽上传）
- ✅ 文件列表（分页、搜索、排序）
- ✅ 文件下载
- ✅ 文件删除
- ✅ 混合存储支持（本地文件系统 + AWS S3）
- ✅ 安全特性（文件类型验证、大小限制、路径清理）
- ✅ 响应式 UI 设计

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

### 5. 运行前端

```bash
cd frontend
npm install
npm run dev
```

前端将在 `http://localhost:5173` 启动。

## 项目结构

```
upload-download-util/
├── backend/              # Rust 后端
│   ├── src/
│   │   ├── api/         # API 路由
│   │   ├── handlers/    # 请求处理器
│   │   ├── models/      # 数据模型
│   │   ├── services/    # 业务逻辑
│   │   ├── middleware/  # 中间件
│   │   ├── database/    # 数据库相关
│   │   ├── config/      # 配置管理
│   │   └── utils/       # 工具函数
│   ├── migrations/      # 数据库迁移
│   └── Cargo.toml
├── frontend/            # React 前端
│   ├── src/
│   │   ├── components/  # React 组件
│   │   ├── pages/       # 页面组件
│   │   ├── services/    # API 服务
│   │   ├── store/       # 状态管理
│   │   └── utils/       # 工具函数
│   └── package.json
├── docker-compose.yml   # PostgreSQL 容器
└── README.md
```

## API 端点

### 认证 API

- `POST /api/auth/register` - 用户注册
- `POST /api/auth/login` - 用户登录
- `GET /api/auth/me` - 获取当前用户信息

### 文件 API

- `GET /api/files` - 获取文件列表（支持分页、搜索）
- `POST /api/files/upload` - 上传文件
- `GET /api/files/:id/download` - 下载文件
- `DELETE /api/files/:id` - 删除文件

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

## 许可证

Copyright © Mua2u Professional Services, LLC. All rights reserved.
