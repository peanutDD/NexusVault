# Backend 测试覆盖审计报告

| 字段 | 值 |
|---|---|
| 日期 | 2026-05-02 |
| 模式 | 方案 A（审计模式，不动代码） |
| 范围 | `backend/src/services/`, `backend/src/handlers/`, `backend/src/middleware/` |
| 现有测试 | 8 个 `tests/*.rs` 文件，2 573 行 |
| 人类决策 | rate_limit 测试归属 middleware；handler 测试用真 Router + 真 PG；CI 卡 `cargo-llvm-cov --fail-under-lines 90` |

---

## 0. 全局结论

| 维度 | 现状 | 缺口 | 优先级 |
|---|---|---|---|
| Service 层 | 中等偏好 | 部分 happy/error path 缺失 | P1 |
| Handler 层 | **几乎为零**（无 axum::Router 集成测试） | 13+ endpoint 全部裸奔 | **P0** |
| Middleware 层 | rate_limit 较好，auth 仅辅助函数 | 缺并发限制测试、缺 ConcurrencyLimit 测试 | P1 |
| CI 覆盖率门槛 | `ci.yml` 已含 `cargo-llvm-cov --fail-under-lines 90` ✅ | 但当前未达 90%（待补测后实测） | P0 |

> CI 已写好覆盖率卡线，**主要缺口在测试本身**，不在 CI 配置。

---

## 1. Services 层审计

### 1.1 `services/file/`

| 策略要求 | 现有测试（`service_file_tests.rs`） | 状态 | 缺口 |
|---|---|---|---|
| 上传 happy path | `test_file_service_chunked_upload_happy_path` | ✅ | — |
| 上传 error path | `test_file_service_chunked_upload_invalid_part_index` / `missing_chunks` / `duplicate_chunk` | ✅ | — |
| **断点续传失败重试** | 仅有 `duplicate_chunk` 幂等 | ⚠️ 部分 | 缺：① 中途网络断开后用 `chunked_upload_status` 恢复 ② SHA-256 校验失败回退 ③ session 过期后续传 |
| **秒传边界条件** | `instant_upload_happy_path` / `invalid_hash` / `empty_hash` | ⚠️ 部分 | 缺：① 已有 sha256 命中复用（当前 happy path 实际返回 None） ② 大小不匹配 hash 命中 ③ 跨用户 hash 命中隔离 |
| 删除 happy/error | `delete_file_happy_path` / `delete_nonexistent_file` / `batch_delete` | ✅ | — |

**Service file 缺口清单**：4 个测试用例（断点续传 3 + 秒传 1 真命中）

### 1.2 `services/auth/`

| 策略要求 | 现有测试（`service_auth_tests.rs`） | 状态 | 缺口 |
|---|---|---|---|
| 注册/登录 happy/error | 已覆盖（empty/duplicate/short pwd/invalid email） | ✅ | — |
| **JWT 过期** | `test_auth_service_verify_token_expired` | ✅ | — |
| **JWT 刷新** | — | ❌ | 代码里**无 refresh_token 实现**（`auth.rs` 只有 `generate_token` / `verify_token`） |
| 修改密码 | 已覆盖 | ✅ | — |
| **API Token 双认证** | `api_token_create_and_verify` / `verify_invalid` / `list` / `delete` | ⚠️ 部分 | 缺：① 过期 API Token（`expires_in_days`）验证失败 ② API Token + JWT 同时存在时优先级 ③ HMAC secret rotation（多 secrets 数组）兼容旧 token |

**Service auth 缺口清单**：3 个 API Token 测试 + 1 条**约束** ⚠️ 「JWT refresh 未实现」需写入 `docs/constraints/`，避免下次再被要求

### 1.3 `services/storage/`（含 storage 切换 & 配额）

| 策略要求 | 现有测试 | 状态 | 缺口 |
|---|---|---|---|
| 本地存储 CRUD | `service_storage_tests.rs` 全套 | ✅ | — |
| **S3 切换** | — | ❌ | 缺 S3 backend 单元测试（即使用 mock，也应覆盖 `presign_download_url` / `save_file` 路径） |
| **存储配额超限** | `service_file_tests.rs::test_file_service_quota_exceeded` | ✅ | — |
| 配额查询 | `test_file_service_get_quota` | ✅ | — |
| 多用户隔离 | `multi_user_isolation` / `cannot_access_other_user_files` | ✅ | — |

**Service storage 缺口清单**：1 个 S3 mock 测试（**P2 — 需 LocalStack 或 mock-s3，可延后**）

### 1.4 ⚠️ 策略 vs 代码不一致：rate_limit

策略文档要求「`services/rate_limit/`」，但代码中**只有 `middleware/rate_limit.rs`**（无独立 service 模块）。

**人类决策（已确认）：测试归属到 middleware 层**，详见第 3 节。无需新建 service 子模块。

### 1.5 其他 services（策略未提，但应纳入覆盖率）

`folder.rs` / `share.rs` / `organization.rs` / `embeddings.rs` / `redis.rs` / `task_queue.rs` / `maintenance.rs` 现状几乎无独立测试，但属于策略外范围，本次审计不展开，仅在覆盖率报告里关注。

---

## 2. Handlers 层审计（**最大缺口**）

**当前 `tests/` 目录下没有任何使用 `axum::Router` 起完整应用的集成测试文件。**

13 个 file handler 全部缺失 happy + error 双路径：

| Endpoint | Handler | 缺口 |
|---|---|---|
| `POST /upload` | `upload_file_handler` | happy(multipart 成功) + error(超 max_file_size / 无 file 字段 / 无效 folder_id) |
| `POST /upload/instant` | `instant_upload_handler` | happy(命中) + happy(未命中 200) + error(invalid hash) |
| `POST /upload/chunked/init` | `chunked_upload_init_handler` | happy + error(total_size=0) |
| `PUT /upload/chunked/{id}/chunk` | `chunked_upload_chunk_handler` | happy + error(part SHA256 mismatch) + error(超 MAX_CHUNK_BODY) |
| `GET /upload/chunked/{id}/status` | `chunked_upload_status_handler` | happy + error(404) |
| `POST /upload/chunked/{id}/complete` | `chunked_upload_complete_handler` | happy + error(missing chunks) |
| `DELETE /upload/chunked/{id}/abort` | `chunked_upload_abort_handler` | happy + error(404) |
| `GET /storage-usage` | `storage_usage_handler` | happy + happy(quota=None) |
| `GET /categories` | `categories_handler` | happy(空) + happy(多分类) |
| `POST /batch` | `batch_get_handler` | happy + error(部分不存在) |
| `POST /batch-delete` | `batch_delete_handler` | happy + error(空列表) |
| `POST /batch-move` | `batch_move_handler` | happy + error(无 category) |
| `GET /download-zip` | `batch_download_zip_handler` | happy + error(空 ids / 无效 uuid) |
| `GET /{id}/download` | `download_file_handler` | happy + Range 请求 + error(404) |
| `DELETE /{id}` | `delete_file_handler` | happy + error(404) |
| `PATCH /{id}` (rename) | `rename_file_handler` | happy + error(同名) |

**Handler 缺口清单：约 32 个测试用例**（13 endpoint × 2 path + 6 个高价值边界）

### 2.1 集成测试基础设施（按人类决策：真 Router + 真 PG）

需新建 `backend/tests/common/app.rs`（或扩 `mod.rs`），提供：

```rust
pub async fn build_test_app(pool: PgPool) -> Router  // 内部调用 create_app()
pub async fn auth_header(service: &AuthService, user_id: Uuid) -> (HeaderName, HeaderValue)
pub async fn login_and_get_token(...) -> String
```

依赖项已经齐全（`axum::Router`、`tower::ServiceExt::oneshot` 现有 dev-deps 中**未引入**，需补 `tower = { version = ..., features = ["util"] }` 到 `[dev-dependencies]` 或验证 prod 版本是否含 `util`）。

> **注**：当前 `backend/Cargo.toml` 中 `tower` features 只有 `"limit", "load-shed"`，缺 `"util"` ⇒ `oneshot` / `ready_oneshot` 不可用。需在 `[dev-dependencies]` 单独引入 `tower = { version = "0.5", features = ["util"] }`。

---

## 3. Middleware 层审计

### 3.1 `middleware/auth.rs`

| 策略要求 | 现有测试（`middleware_tests.rs`） | 状态 | 缺口 |
|---|---|---|---|
| 缺失 token | `test_auth_middleware_verify_token_empty` | ⚠️ 仅辅助函数 | 缺：通过真 Router 发起无 `Authorization` 头的请求，期望 401 |
| 过期 token | `test_auth_middleware_verify_token_expired` | ⚠️ 仅辅助函数 | 同上，需走中间件链 |
| 无效 token | `test_auth_middleware_verify_token_invalid` | ⚠️ 仅辅助函数 | 同上 |

> 当前测试**重新实现了一份 `verify_token_simple`**，没有调用 `crate::middleware::auth` 中的真实中间件。**这等于自欺**——黑盒覆盖率 0，但白盒看起来已覆盖。
> 修复方向：起一个最小 Router，用 `auth_middleware` 包裹一个回声 handler，再断言 401/200。

### 3.2 `middleware/rate_limit.rs`

| 策略要求 | 现有测试 | 状态 | 缺口 |
|---|---|---|---|
| **IP 限流** | `test_rate_limit_ip_basic` / `different_ips` | ✅ | — |
| **用户限流** | `test_rate_limit_user_basic` / `different_users` | ✅ | — |
| **滑动窗口** | `test_rate_limit_window_reset` (1 秒后重置) | ⚠️ 部分 | 严格说当前是**固定窗口**（代码注释也写明 fixed window，moka TTL）。**需修策略文档措辞**或承认实现是 fixed window。建议改文档为「窗口重置行为」。 |
| **并发限制** | — | ❌ | `app.rs` 中 `ConcurrencyLimitLayer::new(512)` 全局 + 各 endpoint 独立的 `ConcurrencyLimitLayer::new(UPLOAD_CONCURRENCY)` 等 LoadShed 行为，**无任何测试**。需要构造 N+1 并发请求验证 503 + `SERVICE_OVERLOADED` |
| Redis 路径 | — | ❌ | `check_ip_rate_limit` 含 redis EVAL 分支，未覆盖。需 testcontainers-redis 或 mock |

**Middleware 缺口清单：4 个测试用例**（auth 真链路 ×3 + 并发限制 ×1，Redis 路径 P2 延后）

---

## 4. 测试用例总缺口（按 PR 拆分建议）

按 AGENTS.md 第 6 条「单 PR ≤ 300 行 / 单功能」拆 5 个 PR：

| PR | 文件 | 测试数 | 估计行数 | 优先级 |
|---|---|---|---|---|
| **PR1** 基础设施 | `tests/common/app.rs` 新增 + `Cargo.toml` 加 `tower util` | 0（仅 helper） | ~120 | P0（其他 PR 依赖） |
| **PR2** Handler 文件 happy/error | `tests/handler_files_tests.rs` | ~32 | ~600（**超 300 行红线 ⇒ 拆 2 个**） | P0 |
| **PR2a** | upload / instant / chunked | ~14 | ~280 | P0 |
| **PR2b** | list / batch / download / delete / rename / storage / categories | ~18 | ~280 | P0 |
| **PR3** Service file 边界补强 | 在 `service_file_tests.rs` 追加 | 4 | ~150 | P1 |
| **PR4** Service auth API Token 边界 | 在 `service_auth_tests.rs` 追加 | 3 | ~120 | P1 |
| **PR5** Middleware 真链路 | 重构 `middleware_tests.rs` | 4 | ~200 | P1 |

> **总计：~38 个新增测试用例 / ~1 200 行**，预计将后端整体覆盖率从「未知」推至 ≥ 90%。

---

## 5. 永久约束（建议写入 `docs/constraints/`）

| 编号 | 约束内容 | 触发原因 |
|---|---|---|
| C-001 | **JWT refresh token 当前未实现**；新需求若要刷新机制，必须显式立项，不可在 auth_tests 里假设 | 策略文档假设存在但代码无 |
| C-002 | rate_limit 实现为**固定窗口**（moka TTL），不是滑动窗口；策略文档与测试断言措辞需对齐 | 文档与代码不一致 |
| C-003 | `tests/middleware_tests.rs` 不允许重写真实中间件的简化副本，必须通过真 Router 链路黑盒测试 | 现有 `verify_token_simple` 反例 |
| C-004 | 集成测试统一通过 `tests/common::build_test_app(pool)` 起完整 `axum::Router` + 真 PG（人类决策） | 标准化 |
| C-005 | CI 覆盖率门槛 `cargo-llvm-cov --fail-under-lines 90`，**任何 PR 跌破即阻塞合并**（人类决策） | 已生效 |

---

## 6. 风险与依赖

1. **dev-deps 缺 `tower::util`** —— PR1 必须先补，否则集成测试写不出来
2. **CI 真 PG 依赖** —— `ci.yml` 已含 `pgvector/pgvector:pg16` service，OK
3. **Redis 路径覆盖** —— 暂不引入 testcontainers，避开 redis 分支测试，标 P2
4. **S3 backend 测试** —— 暂用 LocalStorage 覆盖，S3 标 P2
5. **chunked upload 大文件测试** —— 单测里 `CHUNK_SIZE * 2 + 100` 已足够；handler 集成测试用更小的 chunk_size override（需 config 注入）

---

## 7. 等待人类批准的下一步动作

请在以下选项中拍板：

- [ ] **A**. 仅接受本审计报告，暂不写测试（后续我再开新对话补 PR）
- [ ] **B**. 立即开 PR1（基础设施，~120 行，零测试，极低风险）
- [ ] **C**. 立即按 PR1→PR2a→PR2b→PR3→PR4→PR5 全流程推进
- [ ] **D**. 先把 5 条永久约束写入 `docs/constraints/C-001..C-005.md`，再讨论 PR

> 默认推荐：**B + D**（基础设施 + 约束落地，原子化、低风险）
