# C-001: JWT Refresh Token 未实现

## 约束内容
**JWT refresh token 当前未实现**；新需求若要刷新机制，必须显式立项，不可在 auth_tests 里假设。

## 触发原因
策略文档假设存在 refresh token 机制，但 `backend/src/services/auth/` 中只有 `generate_token` 和 `verify_token`，**无 refresh_token 相关实现**。

## 生效日期
2026-05-02

## 关联文件
- `backend/src/services/auth/`
- `backend/tests/service_auth_tests.rs`

## 例外条件
None