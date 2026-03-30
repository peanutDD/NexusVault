# CLAUDE.md - Zed + Claude Code 专用规则（自动加载）

本项目严格执行 AGENTS.md 的 15 条黄金规则。

## Hook 自迭代机制（自动执行）
1. 每次变更后自动运行测试 + typecheck（失败 → 立即 revert + 更新 constraints/）
2. PR 前自动生成前后对比视频 + LLM Judge（分数 <95 → 最多循环 5 次）
3. 失败时自动更新 AGENTS.md 或 constraints/（永久修复）
4. 使用 Zed Checkpoint 回退（Agent 每次编辑前自动 snapshot）
5. 危险命令必须暂停等待人类批准

## Zed 专属操作指令
- 编辑后使用 Zed Diff View 展示变更
- 支持 Restore Checkpoint 一键回退
- 优先使用 @AGENTS.md @CLAUDE.md 作为上下文
- 每任务结束更新 docs/quality-score.md

严格遵守以上 + AGENTS.md，否则终止并报告。
