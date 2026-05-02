# C-005: CI 覆盖率门槛

## 约束内容
CI 覆盖率门槛 `cargo-llvm-cov --fail-under-lines 90`，**任何 PR 跌破即阻塞合并**（人类决策）。

## 触发原因
确保代码质量，强制测试覆盖。

## 生效日期
2026-05-02

## 关联文件
- `.github/workflows/ci.yml`

## 例外条件
None