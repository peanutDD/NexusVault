# Exec Plan: Auto Review Comment Checklist E2E

## Goal

验证并固化全自动 review 流程会在 PR 评论区自动生成问题清单，逐项标记 `已解决` / `未解决`。

## Assumptions

- Gemini quota 已满，因此本任务不请求新的 Gemini Review。
- 可以用 fake Gemini/Codex agent 和 fake `gh` 在 e2e 中复现 `pr-auto-fix` 自动评论路径。
- 手工 PR 评论不能替代自动评论链路验证。

## Risks

- 只验证 stdout JSON 会漏掉评论区展示失败。
- 只验证本地 ledger 会漏掉 reviewer-facing 结果。
- fake `gh` 若替换整个 `PATH`，会破坏 fake agent 依赖的系统命令。

## Steps

1. 定位 `DryRunFeedbackSkill` / `FeedbackSkill` 的评论生成路径。
2. 新增 e2e 测试，让 `pr-auto-fix` 调用 fake `gh pr comment`。
3. 捕获评论正文，断言包含状态表、已解决、未解决和对应 issue 文案。
4. 跑专项测试、全量 `codex-cli` 测试、clippy、diff check。
5. 提交推送并在 PR 评论区说明验证结果。
