# C-002: Rate Limit 实现为固定窗口

## 约束内容
rate_limit 实现为**固定窗口**（moka TTL），不是滑动窗口；策略文档与测试断言措辞需对齐。

## 触发原因
代码实现使用 moka cache 的 TTL 机制实现固定窗口限流，但策略文档描述为"滑动窗口"，存在术语不一致。

## 生效日期
2026-05-02

## 关联文件
- `backend/src/middleware/rate_limit.rs`

## 例外条件
None