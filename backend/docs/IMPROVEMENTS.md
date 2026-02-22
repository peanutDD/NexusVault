# 后端改进记录

## 2026-02-22 Redis/缓存/API 与数据库优化（补充）

- **数据库一致性**：为避免并发上传导致同目录重复文件名，增加数据库唯一约束（并在迁移中清理历史重复）：[`019_add_files_unique_constraint.sql`](../migrations/019_add_files_unique_constraint.sql)
- **查询可观测性**：启用 `pg_stat_statements`（迁移创建扩展 + compose preload；若数据库用户无 `CREATE EXTENSION` 权限，需要由管理员预先创建扩展或用具备权限的账号执行迁移）：[`020_enable_pg_stat_statements.sql`](../migrations/020_enable_pg_stat_statements.sql)、[docker-compose.yml](file:///Users/tyone/github/upload-download-util/docker-compose.yml)
- **分页性能**：文件列表支持 `include_total=false` 跳过总数计算（大表优化），游标分页保持不算 total：[repositories/files.rs](file:///Users/tyone/github/upload-download-util/backend/src/repositories/files.rs)、[models/file.rs](file:///Users/tyone/github/upload-download-util/backend/src/models/file.rs)
- **Redis 落地**：引入可选 Redis 连接池，覆盖验证码/OAuth state、限流、多实例共享读缓存、缩略图与 HLS 分布式锁：[redis.rs](file:///Users/tyone/github/upload-download-util/backend/src/services/redis.rs)、[API_AND_CACHING_SELF_CHECK.md](./API_AND_CACHING_SELF_CHECK.md)

## 2026-02-09 秒传路径一致性修正

- **问题**：秒传时，新用户的记录会复用「首传用户」的 `file_path`，导致 DB 记录的 `user_id` 与路径中的 `user_id` 不一致（例如：DB 里 `user_id = A`，但路径是 `uploads/B/...`）。
- **问题**：秒传时，新用户的记录会复用「首传用户」的 `file_path`，导致 DB 记录的 `user_id` 与路径中的 `user_id` 不一致（例如：DB 里 `user_id = A`，但路径是 `uploads/B/...`）。
- **根因**：旧实现直接复用任意已有文件的路径，未检查路径是否属于当前用户。
- **修正**：
  - 秒传时检查已有文件路径中的 `user_id`（从路径提取第一个 UUID）。
  - 若路径属于当前用户：复用路径（节省存储）。
  - 若路径属于其他用户：复制文件到当前用户目录，确保 DB `user_id` 与路径 `user_id` 一致。
- **影响**：
  - 修正后：每个用户的文件都在自己的目录下，不再出现跨用户路径引用。
  - 代价：跨用户秒传会复制文件，占用更多存储（为正确性的权衡）。
  - 历史数据：已存在的跨用户路径引用不会自动修复，需手动迁移或删除。
- **涉及**：`src/services/file/instant_upload.rs`、`docs/UPLOAD_API.md`、`ENGINEERING_PLAYBOOK.md`、`src/bin/check_file_owners.rs`（添加 `--delete-with-file` 选项用于清理不一致记录）。

---

## 2026-02-07 缩略图方案 B 与多格式支持（今日变更备注）

- **缩略图接口**：新增 `GET /api/files/:id/thumbnail?w=400`，仅对 `image/*` 返回 JPEG 缩略图；列表卡片使用该接口，与预览原图分离，减轻加载。
- **方案 B（先读盘再按需生成）**：优先读已存在的缩略图（`.thumbnails/{file_id}.jpg`）；无则从原图生成并写盘后返回，后续请求直接读盘。
- **GIF 只解第一帧**：使用 `gif` crate 仅解码第一帧生成缩略图，大 GIF 不整文件解码。
- **多格式解码**：`image` 使用默认 feature，支持 jpeg/png/gif/webp/bmp/ico/tiff/tga/pnm 等。
- **长时间压缩不阻塞**：解码→缩略图→编码在 `tokio::task::spawn_blocking` 中执行，避免占用 async 工作线程导致超时或无法正确返回响应；响应仅在压缩完成并写盘后返回。
- **删除联动**：单文件/批量删除时顺带删除对应缩略图。
- **涉及**：`utils/thumbnail.rs`、`services/storage.rs`（get/save/delete_thumbnail）、`handlers/files/download/mod.rs`、`api/files.rs`、`services/file/read.rs`、`services/file/delete.rs`；前端 `LazyThumbnail` 使用 `fetchThumbnailBlob`，404/415 时显示占位。

详细设计见 `ENGINEERING_PLAYBOOK.md` 第 17 节。

---

## 改进概述

本次改进按优先级从高到低完成，涵盖安全性、架构、可观测性和代码质量多个方面。

---

## P0 - 最高优先级（安全）

### 1. JWT 算法验证修复

**问题**：使用 `Validation::default()` 可能接受多种算法，存在算法混淆攻击风险。

**修复**：
```rust
// 修复前
let token_data = decode::<Claims>(token, &key, &Validation::default());

// 修复后
let mut validation = Validation::new(Algorithm::HS256);
validation.validate_exp = true;
let token_data = decode::<Claims>(token, &key, &validation);
```

**修改文件**：
- `src/extractors/auth.rs`
- `src/services/auth.rs`

### 2. API Token HMAC 加盐

**问题**：使用纯 SHA-256 哈希，无盐值，存在彩虹表攻击风险。

**修复**：使用 HMAC-SHA256，以服务器密钥作为盐值。

```rust
// 修复前
fn hash_token(token: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(token.as_bytes());
    format!("{:x}", hasher.finalize())
}

// 修复后
fn hash_token(&self, token: &str) -> Result<String, AppError> {
    let mut mac = HmacSha256::new_from_slice(self.secret.as_bytes())
        .map_err(|_| AppError::Internal)?;
    mac.update(token.as_bytes());
    Ok(format!("{:x}", mac.finalize().into_bytes()))
}
```

**修改文件**：
- `src/services/api_token.rs`
- `src/extractors/auth.rs`
- `Cargo.toml` (添加 hmac 依赖)

---

## P1 - 高优先级（安全/运维）

### 3. 健康检查完善

**问题**：原健康检查仅返回 "OK"，不检查依赖服务状态。

**修复**：添加数据库和存储后端检查。

```rust
// 新端点
GET /health   - 完整健康检查（数据库 + 存储）
GET /livez    - 轻量级存活检查（k8s liveness）
GET /readyz   - 就绪检查（k8s readiness）
```

**响应示例**：
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "checks": {
    "database": { "status": "up" },
    "storage": { "status": "up" }
  }
}
```

**修改文件**：
- `src/main.rs`
- `src/services/storage.rs` (添加 `health_check` 方法)

### 4. 错误日志脱敏

**问题**：数据库错误直接记录可能泄露 SQL 语句和表结构。

**修复**：
- 添加错误 ID 用于关联日志和用户报告
- 数据库错误脱敏，仅记录错误类型
- 文件路径脱敏
- 响应体不包含原始错误信息

```rust
// 脱敏后的日志
tracing::error!(
    error_id = %error_id,
    error_type = "database",
    details = %sanitized,
    "Database error occurred"
);

// 脱敏后的响应
{
    "message": "数据库操作失败，请稍后重试",
    "code": "DATABASE_ERROR",
    "error_id": "a1b2c3d4",
    "timestamp": "2024-01-15T10:30:00Z"
}
```

**修改文件**：
- `src/utils/error.rs`

---

## P2 - 中优先级（架构）

### 5. API 版本控制

**修复**：添加 `/api/v1/` 前缀，保留旧路由向后兼容。

```
新路由：
/api/v1/auth/*
/api/v1/files/*
/api/v1/folders/*
/api/v1/shares/*
/api/v1/tokens/*

向后兼容（可移除）：
/api/auth/*
/api/files/*
...
```

**修改文件**：
- `src/main.rs`

### 6. 添加 Metrics

**修复**：添加 Prometheus metrics 支持。

**新端点**：`GET /metrics`

**指标列表**：
- `http_requests_total` - HTTP 请求总数
- `http_request_duration_seconds` - 请求延迟直方图
- `http_requests_in_flight` - 正在处理的请求数
- `db_queries_total` - 数据库查询总数
- `file_operations_total` - 文件操作总数
- `auth_attempts_total` - 认证尝试总数

**新增文件**：
- `src/middleware/metrics.rs`

**修改文件**：
- `src/middleware/mod.rs`
- `src/main.rs`
- `Cargo.toml` (添加 metrics、metrics-exporter-prometheus)

### 7. 添加单元测试框架

**新增文件**：
- `tests/common/mod.rs` - 测试辅助函数
- `tests/auth_tests.rs` - 认证测试
- `tests/repository_tests.rs` - Repository 测试

**辅助函数**：
- `init_test_env()` - 初始化测试环境
- `create_test_pool()` - 创建测试数据库连接
- `cleanup_test_data()` - 清理测试数据
- `create_test_user()` - 创建测试用户
- `create_test_file()` - 创建测试文件
- `create_test_folder()` - 创建测试文件夹

---

## P3 - 低优先级（代码质量）

### 8. 添加缓存层

**新增文件**：
- `src/services/cache.rs`

**功能**：
- 用户缓存（5 分钟 TTL）
- 文件元数据缓存（1 分钟 TTL）
- 文件夹缓存（1 分钟 TTL）
- 文件夹列表缓存（30 秒 TTL）

**API**：
```rust
let cache = CacheService::new();
cache.get_user(user_id);
cache.set_user(user);
cache.invalidate_user(user_id);
// ... 类似的文件和文件夹方法
```

### 9. 依赖注入改进

**新增文件**：
- `src/services/traits.rs`

**定义的 Trait**：
- `AuthServiceTrait` - 认证服务接口
- `FileServiceTrait` - 文件服务接口
- `FolderServiceTrait` - 文件夹服务接口

**用途**：
- 支持依赖倒置
- 便于 Mock 测试
- 提高可扩展性

### 10. API 文档生成

**新增文件**：
- `src/api/openapi.rs`

**新端点**：
- `GET /swagger-ui` - Swagger UI
- `GET /api-docs/openapi.json` - OpenAPI JSON

**依赖**：
- utoipa
- utoipa-swagger-ui

---

## 新增依赖

```toml
# Cargo.toml 新增
hmac = "0.12"
metrics = "0.24"
metrics-exporter-prometheus = "0.16"
utoipa = { version = "5", features = ["axum_extras", "uuid", "chrono"] }
utoipa-swagger-ui = { version = "8", features = ["axum"] }
```

---

## 构建结果

```
cargo build --release
Finished `release` profile [optimized] target(s) in 27.77s
```

---

## 后续建议

1. **完善 OpenAPI 文档**：为所有模型类型添加 `ToSchema` derive
2. **集成测试**：使用 `axum-test` 编写 API 集成测试
3. **Redis 缓存**：将内存缓存替换为 Redis，支持分布式部署
4. **限流优化**：按 API 类型设置不同的限流策略
5. **监控告警**：集成 Grafana 和 Alertmanager
