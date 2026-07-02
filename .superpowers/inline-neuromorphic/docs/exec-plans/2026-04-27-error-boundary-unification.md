# Error Boundary Unification

日期：2026-04-27
范围：`backend/src/services/auth.rs`、`backend/src/services/file/chunked_upload.rs` 及其领域错误模块

## 目标

- 为 `auth` 与 `file chunked upload` 建立类型化领域错误。
- 保持 handler 层统一返回 `Result<_, AppError>`。
- 减少 service 层直接拼装 `AppError::{Validation,Storage,File,...}` 的分散写法。

## 假设

- 启动阶段（`main.rs`、`bin/*`）仍允许使用 `anyhow` 聚合初始化错误。
- 现有未提交改动不会改变 `auth` 与 `chunked upload` 的外部行为要求。
- 本次先建立迁移模式，不一次性改完整个 backend。

## 风险

- 错误映射如果偏移，可能改变 HTTP 状态码或用户消息。
- 分块上传路径较长，回归风险高于普通 CRUD。
- 测试依赖编译完整 backend，反馈周期会偏慢。

## 依赖

- `thiserror` 继续作为领域错误声明工具。
- 现有 `AppError` 继续承担 HTTP 响应和日志脱敏职责。
- 现有 service/repository trait 暂时仍以 `AppError` 为仓储边界。

## 执行步骤

1. 先为领域错误到 `AppError` 的转换写单元测试。
2. 新增 `AuthServiceError` 与 `FileServiceError`。
3. 将 `auth` 和 `chunked upload` service 方法改为返回领域错误。
4. 通过 `From<DomainError> for AppError` 保持 handler 边界不变。
5. 新增永久约束文档，限制后续 service 继续直接堆叠 `AppError`。
