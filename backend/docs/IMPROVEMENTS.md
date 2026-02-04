# 后端改进记录

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
fn hash_token(&self, token: &str) -> String {
    let mut mac = HmacSha256::new_from_slice(self.secret.as_bytes())
        .expect("HMAC can take key of any size");
    mac.update(token.as_bytes());
    format!("{:x}", mac.finalize().into_bytes())
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
