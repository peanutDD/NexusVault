# 测试策略

## 现状

| 项目 | 文件数 | 覆盖率估算 |
|------|--------|------------|
| 后端测试 | 9 个（`auth_tests.rs`、`cursor_pagination_tests.rs`、`repository_tests.rs`、`service_file_tests.rs`、`service_cache_tests.rs`、`service_auth_tests.rs`、`service_storage_tests.rs`、`middleware_tests.rs`、`handler_files_upload_tests.rs`） | ~60% |
| 前端测试 | 4 个（`pretextMeasure.test.ts`、`uploadValidation.test.ts`、`FileListFilters.test.tsx`、`useDebounce.test.ts`、`useThrottle.test.ts`、`useDialog.test.ts`） | ~35% |

与 `AGENTS.md` 中 **"TDD 铁律：覆盖率 ≥ 90%"** 的规则严重不符。

---

## 已实现的测试

### 后端测试文件

| 文件 | 模块 | 覆盖内容 |
|------|------|----------|
| `service_file_tests.rs` | 文件服务 | 文件重命名、列表查询、存储用量 |
| `service_cache_tests.rs` | 缓存服务 | Redis 用户版本管理、文件列表缓存、缓存失效 |
| `service_auth_tests.rs` | 认证服务 | 用户注册、登录、JWT 验证、Token 过期 |
| `service_storage_tests.rs` | 存储服务 | 本地存储 CRUD、缩略图操作、流读取 |
| `middleware_tests.rs` | 中间件层 | IP 限流、用户限流、Token 验证 |
| `handler_files_upload_tests.rs` | Handler 层 | 上传、秒传、分块上传全链路集成测试（14 个测试用例） |

### 前端测试文件

| 文件 | 模块 | 覆盖内容 |
|------|------|----------|
| `useDebounce.test.ts` | Hooks | 防抖逻辑、延迟更新、超时取消 |
| `useThrottle.test.ts` | Hooks | 节流逻辑、频率限制、trailing 值 |
| `useDialog.test.ts` | Hooks | ESC 关闭、背景点击、自动聚焦 |

---

## 后端测试策略

### 核心服务层（`services/`）

#### `file/` 模块
- 上传 happy path + error path
- 下载 happy path + error path
- 删除 happy path + error path
- 断点续传失败重试
- 秒传边界条件

#### `auth/` 模块
- JWT 过期/刷新
- API Token 双认证

#### `storage/` 模块
- 本地/S3 切换
- 存储配额超限

### Handler 层（`handlers/`）
- 每个 API endpoint 至少 1 个 happy path + 1 个 error path
- 重点覆盖：分片上传、断点续传、批量操作
- **进度**：✅ PR2a 完成（upload / instant / chunked 14 个测试）；⏳ PR2b 待完成（list / batch / download / delete / rename / storage / categories）

### Middleware 层（`middleware/`）
- 认证中间件（缺失 token、过期 token、无效 token）
- 限流中间件（IP 限流、用户限流、并发限制）

---

## 前端测试策略

### 核心 Hooks

#### `useFileUpload`
- 拖拽上传
- URL 上传
- 分片进度
- 断点续传

#### `useFileList`
- 无限滚动
- 过滤
- 排序
- 分组

#### `useFileActions`
- 删除
- 重命名
- 移动
- 分享

### 关键组件

#### `UploadDialog`
- 上传队列
- 进度条
- 错误提示

#### `FilePreviewContent`
- 图片预览
- PDF 预览
- 视频预览
- GIF 预览
- Markdown 预览

#### `FileListContent`
- 虚拟滚动
- 按类型分组
- 按时间分组

---

## 工具引入

### 后端
- `cargo-llvm-cov`：覆盖率 + HTML 报告

### 前端
- `vitest --coverage`
- `c8`：覆盖率报告

---

## 里程碑

| 阶段 | 目标 | 验收标准 |
|------|------|----------|
| 1 周 | 后端服务层覆盖 ≥ 80% | `cargo-llvm-cov report --lcov` 通过 |
| 2 周 | 前端核心组件覆盖 ≥ 70% | `vitest --coverage` 通过 |
| 1 月 | 整体覆盖率 ≥ 90% | CI 中覆盖率检查通过 |

---

## 快速开始

### 后端测试

```bash
# 运行所有测试
cargo test

# 生成覆盖率报告
cargo llvm-cov --html

# 查看覆盖率报告
open target/llvm-cov/html/index.html
```

### 前端测试

```bash
# 运行所有测试
npm test

# 生成覆盖率报告
npm run test:coverage

# 查看覆盖率报告
open coverage/index.html
```
