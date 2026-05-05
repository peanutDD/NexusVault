# 测试策略

## 现状

| 项目 | 文件数 | 覆盖率估算 |
|------|--------|------------|
| 后端测试 | 6 个（`auth_tests.rs`、`cursor_pagination_tests.rs`、`repository_tests.rs`、`service_file_tests.rs`、`service_cache_tests.rs`、`service_auth_tests.rs`、`service_storage_tests.rs`、`middleware_tests.rs`） | ~55% |
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

### 前端测试文件

| 文件 | 模块 | 覆盖内容 |
|------|------|----------|
| `useDebounce.test.ts` | Hooks | 防抖逻辑、延迟更新、超时取消 |
| `useThrottle.test.ts` | Hooks | 节流逻辑、频率限制、trailing 值 |
| `useDialog.test.ts` | Hooks | ESC 关闭、背景点击、自动聚焦 |

---

## 后端测试策略

执行计划：后端测试策略落地（exec-plan）

## 目标（Goal）
将 `docs/testing-strategy.md` 中列出的后端测试策略从「文档计划」落地成「可执行测试代码 + 覆盖率基线」，使后端服务层 / Handler 层 / Middleware 层测试覆盖率在 **1 周内 ≥ 80%**，并建立 CI 可机器校验的入口。

## 现状快照（Repo Recon 结果）

| 层 | 源码模块 | 已有测试 | 覆盖差距 |
|---|---|---|---|
| **services/file** | `upload / chunked_upload / instant_upload / delete / list / versions / quota / read / categories / batch_zip / hls / semantic_search / video` (13 个子模块) | `service_file_tests.rs` 705 行，已覆盖：rename、list、quota、chunked happy + 3 error、instant 3 case、delete 3 case | ❌ **download/read 流**、❌ **断点续传「重试」(非续传)**、❌ **秒传命中 happy path**、❌ **versions**、❌ **batch_zip**、❌ **hls** |
| **services/auth** | `auth.rs` + `auth/error.rs` | `service_auth_tests.rs` 537 行 | ✅ JWT 过期、刷新基本覆盖；❌ **API Token 双认证**（`api_token.rs` 无测试） |
| **services/storage** | `storage.rs`（本地+S3 trait）、`file/storage_factory.rs` | `service_storage_tests.rs` 375 行，只覆盖 Local | ❌ **本地/S3 切换**（工厂路径）、❌ **配额超限在 storage 层的表现** |
| **services/cache (rate_limit)** | `middleware/rate_limit.rs` 内滑动窗口 | `middleware_tests.rs` 覆盖 IP/用户/窗口重置/叠加 | ⚠️ 滑动窗口精细边界（tick 边缘、并发竞争）缺失 |
| **handlers/** | 8 个 handler + `files/` 下 13 个子 handler | **0 个集成测试**（现有仅调用 service 层） | ❌ **全部 endpoint happy+error** 缺失，尤其 chunked_upload / batch / download |
| **middleware/** | `auth / rate_limit / cors / metrics / panic / request_log` | `middleware_tests.rs` 297 行，只测 rate_limit + 简单 JWT 解码 | ❌ **auth middleware 实体测试**（需要 Request 注入 Extension）、❌ **panic 中间件恢复** |

## 拆解任务（按 AGENTS.md 第 6 条「小步迭代，每 PR ≤ 300 行」切分）

| # | PR 标题 | 新增/修改文件 | 预估行数 | 依赖 |
|---|---|---|---|---|
| **1** | `test(service/file): 秒传命中 + 下载流 happy/error` | `tests/service_file_download_tests.rs`（新）、扩展 `service_file_tests.rs` 秒传 hit | ~220 | 无 |
| **2** | `test(service/file): versions + batch_zip + hls 核心路径` | `tests/service_file_advanced_tests.rs`（新） | ~260 | #1 合并 |
| **3** | `test(service/auth): api_token 双认证（JWT + X-API-Token）` | `tests/service_api_token_tests.rs`（新） | ~200 | 无 |
| **4** | `test(service/storage): 工厂切换 + S3 mock（aws-sdk-s3 test_util）` | `tests/service_storage_s3_tests.rs`（新） | ~240 | 无 |
| **5** | `test(handlers): 集成测试框架（axum::Router + tower::ServiceExt）` | `tests/common/app_harness.rs`（新）、`tests/handler_auth_tests.rs`、`tests/handler_files_basic_tests.rs` | ~290 | 无 |
| **6** | `test(handlers/files): chunked_upload + instant_upload + batch endpoint` | `tests/handler_files_upload_tests.rs`（新） | ~280 | #5 |
| **7** | `test(middleware): auth + panic + rate_limit 滑窗并发` | 扩展 `middleware_tests.rs` + 新 `tests/middleware_auth_integration_tests.rs` | ~270 | #5 |
| **8** | `ci: 引入 cargo-llvm-cov，门槛 80% 并在 CI 产出 lcov` | `.github/workflows/backend-test.yml`、`scripts/coverage.sh` | ~120 | #1–#7 全部合并 |

**总计 ~1880 行测试代码 + CI 配置 = 8 个独立 PR**，可并行（#1/#2/#3/#4 无相互依赖；#5 是 handler/middleware 集成测试的地基）。

## 关键风险与假设（Assumptions & Risks）

| 项 | 内容 | 缓解 |
|---|---|---|
| **假设 A1** | 本地 PostgreSQL 可用（`file_storage_test` DB），migrations 可执行 | `common::create_test_pool` 已实现自动建库 ✅ |
| **假设 A2** | S3 mock 使用 `aws-sdk-s3` v1.131 官方 `testing` 功能 / 或 `localstack` docker | PR #4 前先跑 `crates_api.get_features aws-sdk-s3` 验证；若无则换 `wiremock` |
| **风险 R1** | Handler 集成测试需要 axum `Router` + App state 完整注入，现有 `app.rs` 可能不易 mock | PR #5 先抽出 `build_test_app(pool) -> Router` 辅助函数，失败则降级为「直接 handler fn 单测」 |
| **风险 R2** | `FileService` 构造依赖 10 个字段，改动签名将连带测试辅助函数 | 在 `tests/common/mod.rs` 新增 `build_file_service(pool)` 集中构造，后续签名变更只改一处 |
| **风险 R3** | 覆盖率卡在 80% 但未达 90%（AGENTS 铁律） | 里程碑按 `testing-strategy.md` 节奏：1 周 80% → 1 月 90%，分阶段达标，在 `docs/quality-score.md` 记录每周进度 |
| **风险 R4** | CI 机器跑 `cargo-llvm-cov` 编译耗时长（~8 min） | 仅在 `main` 分支和 release PR 上跑完整 llvm-cov；feature PR 只跑 `cargo test` |

## 危险操作清单（按 AGENTS.md 第 8 条需要人类批准）
- ❌ 无 `rm`、无 migration、无 env 修改 → **本次计划 0 个危险操作**
- ✅ 所有变更都是 `tests/` 下新增文件 + 1 个 CI workflow，对生产代码零侵入

## 验收标准（Definition of Done）
1. `cargo test --package file-storage-backend` 全绿
2. `cargo llvm-cov --package file-storage-backend --summary-only` 报告：
   - `services/file/` ≥ 80%
   - `services/auth/`  ≥ 85%
   - `services/storage/` ≥ 75%
   - `handlers/` ≥ 70%
   - `middleware/` ≥ 85%
3. `docs/quality-score.md` 追加本周分数
4. CI workflow `backend-test.yml` 在 GitHub Actions 绿灯
5. `docs/testing-strategy.md` 现状表更新为实际覆盖率

## 下一步（等人类批准后的首个动作）
开始 **PR #1**：新建 `backend/tests/service_file_download_tests.rs`，覆盖：
- `test_download_file_happy_path`（写入 → 读出 → 字节对比）
- `test_download_nonexistent_file`
- `test_download_wrong_owner`（权限边界）
- `test_instant_upload_hit_existing_file`（先 upload 真实内容得 sha256，再 instant_upload 命中）

---

**请人类确认（Approve / Modify / Reject）**：
- ✅ **Approve** → 我从 PR #1 开始按顺序推进，每完成一个 PR 汇报并等下一次批准
- ✏️ **Modify** → 告诉我要调整的项（例如「跳过 S3」「先做 handlers」「门槛改 70%」等）
- ❌ **Reject** → 说明原因，我会重新设计

> 依据：AGENTS.md 第 6 条（小步迭代）、第 8 条（安全边界）、第 11 条（Progressive Disclosure）—— 我**不会**在未获批准前直接写测试代码

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
