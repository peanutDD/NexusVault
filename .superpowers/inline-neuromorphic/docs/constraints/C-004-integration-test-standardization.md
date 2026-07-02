# C-004: 集成测试标准化

## 约束内容
集成测试统一通过 `tests/common::build_test_app(pool)` 起完整 `axum::Router` + 真 PG（人类决策）。

## 触发原因
确保所有集成测试使用一致的测试基础设施，避免重复造轮子。

## 生效日期
2026-05-02

## 关联文件
- `backend/tests/common/app.rs`
- `backend/tests/*.rs`

## 例外条件
None