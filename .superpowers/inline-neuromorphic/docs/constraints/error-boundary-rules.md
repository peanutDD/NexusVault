# Error Boundary Rules

更新时间：2026-04-27

## 永久约束

1. `services/` 中新增业务逻辑时，优先定义领域错误枚举，不要直接把 `AppError` 当作 service 内部语义模型。
2. `handlers/` 继续统一收敛到 `Result<T, AppError>`，HTTP 状态码与响应体映射只能在边界层发生。
3. `anyhow` 仅允许用于启动阶段、脚本入口或一次性工具；业务请求路径不得用 `anyhow!` 吞掉领域错误语义。
4. 如果 service 需要把底层错误暴露到 handler，必须通过 `From<DomainError> for AppError>` 明确声明映射。
5. 新增错误分支时，至少补一个单元测试锁定到 `AppError` 的映射结果。
