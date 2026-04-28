# 后端依赖升级与 OpenTelemetry 追踪集成

**日期**: 2026-04-28  
**任务**: 升级后端依赖版本到最新兼容版本 + 添加 OpenTelemetry 分布式追踪

---

## 1. 依赖版本升级

### 1.1 升级清单

| Crate | 当前版本 | 升级后版本 | Rust 版本要求 | 说明 |
|-------|---------|-----------|--------------|------|
| axum | 0.7 | 0.8 | 1.75+ | 改进 extractor、error handling |
| aws-sdk-s3 | 1.0 | 1.82+ | 1.70+ | 大量 bug 修复和性能改进 |
| aws-config | 1.0 | 1.6+ | 1.70+ | 同上 |
| jsonwebtoken | 9.2 | 9.3 | 1.65+ | 安全补丁 |
| moka | 0.12 | 0.12.10+ | 1.65+ | 内存管理改进 |
| image | 0.25 | 0.25.6+ | 1.65+ | CVE 修复 |

### 1.2 OpenTelemetry 依赖

| Crate | 版本 | 说明 |
|-------|------|------|
| tracing-opentelemetry | 0.29 | Tracing 与 OpenTelemetry 集成 |
| opentelemetry | 0.28 | OpenTelemetry 核心 API |
| opentelemetry_sdk | 0.28 | OpenTelemetry SDK |
| opentelemetry-otlp | 0.28 | OTLP 导出器（grpc-tonic 特性） |
| opentelemetry-semantic-conventions | 0.28 | 语义约定 |

---

## 2. axum 0.8 兼容性修复

### 2.1 移除 async_trait 宏

**原因**: axum 0.8 原生支持 async trait，不再需要 `axum::async_trait` 宏

**修改文件**:
- `src/extractors/admin.rs`
- `src/extractors/auth.rs`

**修改内容**:
```rust
// 修改前
use axum::{async_trait, ...};

#[async_trait]
impl FromRequestParts<AppState> for AdminToken {
    async fn from_request_parts(...) -> Result<Self, Self::Rejection> {
        // ...
    }
}

// 修改后
use axum::...; // 移除 async_trait

impl FromRequestParts<AppState> for AdminToken {
    async fn from_request_parts(...) -> Result<Self, Self::Rejection> {
        // ...
    }
}
```

### 2.2 路由语法变更

**原因**: axum 0.8 更新了路由参数语法

| 旧语法 | 新语法 | 说明 |
|--------|--------|------|
| `/:id` | `/{id}` | 参数路由 |
| `/*path` | `{*path}` | 通配符路由 |

**修改文件**:
- `src/api/admin.rs` - 1 处
- `src/api/files.rs` - 10 处（包括通配符路由）
- `src/api/folders.rs` - 5 处
- `src/api/organizations.rs` - 4 处
- `src/api/api_token.rs` - 1 处
- `src/api/share.rs` - 3 处

**总计**: 24 处路由语法修改

---

## 3. OpenTelemetry 分布式追踪集成

### 3.1 配置说明

**文件**: `src/tracing.rs`

**核心功能**:
- OTLP 导出器（默认端点：`http://localhost:4317`）
- 多种采样策略支持
- trace_id 在请求间传播
- 资源属性自动添加（服务名、版本、OS 信息）

### 3.2 环境变量

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `OTEL_SERVICE_NAME` | `file-storage-backend` | 服务名称 |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://localhost:4317` | OTLP 端点 |
| `OTEL_TRACES_SAMPLER` | `parentbased_traceidbased` | 采样策略 |
| `OTEL_TRACES_SAMPLER_ARG` | `0.1` | 采样率（traceidbased 策略） |

### 3.3 采样策略

- `always_on`: 全部采样
- `always_off`: 不采样
- `parentbased_always_on`: 基于父 span，默认全部采样
- `parentbased_always_off`: 基于父 span，默认不采样
- `parentbased_traceidbased`: 基于 trace ID 比例采样（默认 10%）

### 3.4 Trace ID 传播

**请求日志**: 自动包含 trace_id 字段

**响应头**: 通过 `X-Trace-Id` 传播（在 `utils/error.rs` 中实现）

**Jaeger 集成**: 已在 `docker-compose.yml` 中配置 Jaeger

---

## 4. 验收结果

### 4.1 编译检查

| 命令 | 状态 |
|------|------|
| `cargo check` | ✅ 通过 |
| `cargo clippy --all-targets --all-features -- -D warnings` | ✅ 无警告 |

### 4.2 测试验证

| 命令 | 状态 |
|------|------|
| `cargo test` | ✅ 全部通过（30+ 测试） |

### 4.3 构建验证

| 命令 | 状态 |
|------|------|
| `cargo build --profile dist` | ✅ 成功（21MB 二进制） |

---

## 5. 运行说明

### 5.1 启动 Jaeger

```bash
docker-compose up -d jaeger
```

### 5.2 启动后端服务（启用追踪）

```bash
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
export OTEL_SERVICE_NAME=file-storage-backend
cargo run
```

### 5.3 访问 Jaeger UI

```
http://localhost:16686
```

### 5.4 查看追踪

在 Jaeger UI 中：
1. 选择服务：`file-storage-backend`
2. 点击 "Find Traces"
3. 点击具体的 trace 查看详细信息

---

## 6. 风险缓解

### 6.1 兼容性

- 项目 MSRV 为 Rust 1.77.2
- 所有升级包均兼容 Rust 1.77.2+

### 6.2 Breaking Changes

**axum 0.8 主要变更**:
- `Extension` 替代 `State`（不适用，项目已用 `State<AppState>`）
- `Json` 的反序列化错误处理（已用 `AppError` 包装，无影响）
- 路由语法变更（已修复）

### 6.3 回退方案

已备份 `Cargo.lock` 到 `Cargo.lock.backup`，如需回退：

```bash
cp Cargo.lock.backup Cargo.lock
cargo update
```

---

## 7. 后续优化建议

### 7.1 追踪增强

- 为关键业务操作添加自定义 span
- 添加业务指标（如上传成功率、响应时间）
- 集成告警系统

### 7.2 性能优化

- 调整采样策略（生产环境建议使用 `parentbased_traceidbased`）
- 优化 span 粒度（避免过度追踪）
- 考虑使用异步导出器

### 7.3 监控集成

- 集成 Prometheus metrics（已有基础）
- 配置 Grafana 仪表板
- 设置告警规则

---

## 8. 参考资料

- [axum 0.8 Migration Guide](https://docs.rs/axum/latest/axum/migration_guide/0_7_to_0_8.html)
- [OpenTelemetry Rust Documentation](https://docs.rs/opentelemetry/)
- [Jaeger Documentation](https://www.jaegertracing.io/docs/)
