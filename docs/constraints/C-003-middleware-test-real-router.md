# C-003: Middleware 测试必须通过真 Router 链路

## 约束内容
`tests/middleware_tests.rs` 不允许重写真实中间件的简化副本，必须通过真 Router 链路进行黑盒测试。

## 触发原因
现有测试重新实现了 `verify_token_simple`，没有调用 `crate::middleware::auth` 中的真实中间件，导致黑盒覆盖率为 0，但白盒看起来已覆盖。

## 生效日期
2026-05-02

## 关联文件
- `backend/tests/middleware_tests.rs`

## 例外条件
None