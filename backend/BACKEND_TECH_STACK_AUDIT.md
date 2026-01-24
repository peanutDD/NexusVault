# Backend Tech-Stack Skill 合规检查报告

依据 `.cursor/skills/backend-tech-stack/SKILL.md` 对后端实现进行逐项检查。

---

## 1. 技术栈概览 ✅

| 技术 | Skill 要求 | 实际 | 状态 |
|------|------------|------|------|
| Web 框架 | Axum 0.7 | axum 0.7 | ✅ |
| 异步运行时 | Tokio (full) | tokio 1, features = ["full"] | ✅ |
| 数据库 | SQLx 0.7, PostgreSQL | sqlx 0.7, postgres, migrate | ✅ |
| 认证 | JWT + bcrypt | jsonwebtoken 9.2, bcrypt 0.15 | ✅ |
| 错误处理 | thiserror + anyhow | thiserror 1.0, anyhow 1.0 | ✅ |
| 日志 | tracing + tracing-subscriber | tracing 0.1, tracing-subscriber 0.3, env-filter | ✅ |
| 序列化 | serde + serde_json | serde 1.0, serde_json 1.0 | ✅ |
| 存储 | AWS S3 或本地 | aws-sdk-s3, aws-config；LocalStorage / S3Storage | ✅ |
| 验证 | validator | validator 0.18, derive | ✅ |
| 其他 | chrono, uuid, dotenv, config, tower, tower-http | 均已使用 | ✅ |

---

## 2. 项目架构 ✅

Skill 约定结构：

```
src/
├── api/          # 路由定义
├── handlers/     # HTTP 请求处理
├── services/     # 业务逻辑层
├── models/       # 数据模型
├── middleware/   # 中间件
├── database/     # 数据库连接池
├── utils/        # 工具函数
└── config.rs     # 配置管理
```

**实际**：以上模块均存在。额外有 `extractors/`（认证等 extractor），与「统一认证提取」一致，视为合规。

---

## 3. Axum 路由与处理器 ✅

### 3.1 路由定义

- 路由在 `api/` 下按模块划分（`api/auth`, `api/files`, `api/share`, `api/api_token`），各 `create_router()` 返回 `Router`。✅

### 3.2 处理器签名

- 使用 `Extension` 注入 `PgPool`、`Arc<Config>`、`Arc<dyn StorageBackend>`。✅
- 需认证的 handler 使用 `AuthenticatedUser` extractor，等价于「从 header 提取并验证用户」。✅
- 使用 `Path`、`Query`、`Json`、`Multipart` 等 extractor。✅

### 3.3 响应格式

- 统一 JSON：`utils::response` 提供 `json_response`、`file_response`、`success_response` 等。✅
- 文件列表使用 `{ "files", "total", "page", "limit" }`，与 skill 及前端 `FileListResponse` 一致。✅（已修复原 `items` 问题）

---

## 4. 数据库 (SQLx) ✅

### 4.1 连接池

- `database/pool.rs` 中 `create_pool` 使用 `PgPoolOptions`，配置了 `max_connections`、`min_connections`、`acquire_timeout`、`idle_timeout`、`max_lifetime`、`test_before_acquire`。✅

### 4.2 查询模式

- 静态查询：`sqlx::query_as::<_, T>` 等，类型安全。✅
- 动态查询：如 `list_files` 中动态 WHERE，使用 `sqlx::query` + `FromRow`。✅

### 4.3 迁移

- `main` 中 `sqlx::migrate!("./migrations").run(&pool).await`。✅

---

## 5. 错误处理 ✅

### 5.1 错误类型

- `utils/error.rs` 中 `AppError` 使用 `thiserror::Error`，包含 `Database`、`Auth`、`Validation`、`File`、`Storage`、`NotFound`、`Unauthorized`、`Forbidden`、`Internal`。✅

### 5.2 错误响应

- `AppError` 实现 `IntoResponse`，统一 `{ error, message, code, timestamp }`，并按类型打日志。✅

### 5.3 错误传播

- 普遍使用 `?` 向上传播，`Option` 配合 `.ok_or(AppError::NotFound)?` 等。✅

---

## 6. 认证与授权 ✅

### 6.1 JWT 校验

- `middleware/auth.rs` 中 `verify_token_simple` / `extract_user_id_from_token` 使用 `jsonwebtoken` 解码、校验 `Claims`（sub/exp/iat）。✅
- `extractors/auth.rs` 中 `AuthenticatedUser` 封装同样逻辑，并支持 API Token 回退。✅

### 6.2 处理器中获取用户

- 通过 `AuthenticatedUser(user_id)` extractor，不再在各 handler 内重复解析 header。✅

### 6.3 密码哈希

- `services/auth.rs` 使用 `bcrypt::hash` / `bcrypt::verify`，`DEFAULT_COST`。✅

---

## 7. 服务层 ✅

- `FileService`、`AuthService`、`ShareService`、`ApiTokenService` 等均在 `services/`，接收 `PgPool`、`Config`、`Storage` 等依赖。✅
- Handler 仅做 HTTP 解析与响应，业务逻辑在 service。✅

---

## 8. 存储抽象 ✅

- `services/storage.rs` 定义 `StorageBackend` trait（`async_trait`），`save_file`、`get_file`、`delete_file`。✅
- `LocalStorage`、`S3Storage` 分别实现，使用 `tokio::fs` 与 AWS SDK。✅

---

## 9. 中间件 ✅

- 自定义 `request_logger`：记录 method、path、status、elapsed_ms。✅
- `main` 中通过 `ServiceBuilder` 组合 `TraceLayer`、`TimeoutLayer`、`CorsLayer`，以及 `rate_limit`、`request_logger`。✅
- 使用 `Extension` 注入 config、pool、storage。✅

---

## 10. 配置 ✅

- `config.rs` 中 `Config::from_env()` 从环境变量读取，必填项 `DATABASE_URL`、`JWT_SECRET` 等缺失时返回 `ConfigError`。✅
- 其余有默认值（如 `JWT_EXPIRY`、`PORT`、`CORS_ORIGIN` 等）。✅

---

## 11. 日志与追踪 ✅

- `main` 中 `tracing_subscriber::fmt().with_env_filter(...).init()`。✅
- 使用 `tracing::info!`、`tracing::warn!`、`tracing::error!`、`tracing::debug!`。✅

---

## 12. 文件上传 ✅

- 使用 `axum::extract::Multipart`，按 field 解析，`AppError::File` 处理解析失败。✅
- 分块上传有 init/chunk/status/complete/abort 一套接口。✅

---

## 13. 验证 ✅

- `CreateApiTokenRequest` 等使用 `validator::Validate`。✅
- `utils/validation` 提供 `sanitize_filename`、`validate_mime_type`、`validate_file_size`。✅

---

## 14. 文件验证与安全 ✅

- 文件名：移除 `..`、`/`、`\`、`\0`，空则 `Validation`。✅
- MIME：通配符 `image/*` 及精确匹配。✅
- 大小：`validate_file_size` 校验 `max_file_size`。✅
- 存储配额：`create_file` 前 `get_storage_usage` / `get_storage_quota` 检查。✅

---

## 15. 数据模型与响应 ✅

- 使用 `FromRow`、`serde` 序列化。✅
- 有 `FileResponse` 等响应模型，不暴露 `file_path` 等敏感字段。✅
- `From<File> for FileResponse` 等转换。✅

---

## 16. 最佳实践小结

| # | 实践 | 状态 |
|---|------|------|
| 1 | 使用 `AppError`，不随意 panic | ⚠️ 见下文 |
| 2 | 静态查询 `query_as!` / 动态 `query` + `FromRow` | ✅ |
| 3 | 通过 `Extension` 注入共享状态 | ✅ |
| 4 | 业务逻辑在服务层 | ✅ |
| 5 | 使用 `tokio::fs`，避免阻塞 | ✅ |
| 6 | 结构化日志（tracing） | ✅ |
| 7 | 配置从环境变量加载，有默认值 | ✅ |
| 8 | 输入校验、参数化查询、文件名清理 | ✅ |
| 9 | 连接池、索引等性能考虑 | ✅ |
| 10 | 可配合 `sqlx::test` 做集成测试 | ✅ |
| 11 | 临时文件与缓存清理 | ✅ |
| 12 | 内部错误打日志，对用户返回友好信息 | ✅ |

---

## 17. 已修复项

### 17.1 文件列表 API 字段名（已修复）

- **问题**：`list_files` 曾通过 `paginated_response` 返回 `items`，与 skill 及前端 `FileListResponse` 的 `files` 不一致。
- **处理**：改为 `json_response(json!({ "files": files, "total": total, "page": page, "limit": limit }))`，与 skill 和前端对齐。

---

## 18. 建议与待改进

### 18.1 谨慎使用 panic / expect / unwrap

- **现状**：`main` 中 `migrate::run`、`create_storage` 使用 `.expect(...)`；`services/file.rs` 中 `and_hms_opt(...).unwrap()`；`rate_limit` 中 `HeaderValue::from_str(...).unwrap()`。
- **建议**：启动失败可保留 `expect`，但建议加清晰文案；业务逻辑中 `and_hms_opt` 改为 `ok_or(AppError::...)` 等；`HeaderValue` 可 `unwrap_or_else` 或集中封装，避免散落 `unwrap`。

### 18.2 未使用符号

- `middleware::auth::extract_user_id_from_token`：已由 `extractors::auth` 替代，可考虑删除或标记 `#[deprecated]`。
- `utils::response::paginated_response`：当前未使用；若其它列表接口也需要分页，可保留；否则可删或 `#[allow(dead_code)]`。

### 18.3 Skill 文档与实现差异

- Skill 示例中仍写「从 header 提取 + `extract_user_id`」，而当前推荐使用 `AuthenticatedUser` extractor。若 skill 更新，可同步示例，避免读者混淆。

---

## 19. 总结

- 技术栈、项目结构、路由、数据库、错误处理、认证、服务层、存储抽象、中间件、配置、日志、文件上传、验证与安全、数据模型等方面均符合 backend-tech-stack skill 要求。
- 已修复文件列表 `files` / `items` 不一致问题，接口与 skill 及前端约定一致。
- 后续可重点处理：减少 `unwrap`/`expect`、清理未使用代码，以及 skill 文档与实现示例的同步。

**合规结论：通过。**
