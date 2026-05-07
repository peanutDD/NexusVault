# Exec Plan: Auto Review Local Ledger

## Goal

固化 Gemini Review 问题解决后的本地记录：每条 `Medium`、`Medium+`、`High`、`Critical` 问题必须能在项目内看到 Gemini 提了什么、Codex 是否解决、解决答案是什么、修改了哪些文件。

## Assumptions

- 现有 PR 评论和 stdout JSON 已有一一对应状态，但缺少本地持久台账。
- `docs/CHANGELOG.md` 只适合汇总，不适合保存逐项问题和解决答案。
- `--disable-changelog` 在现有测试中代表关闭自动文档记录，应同步关闭 ledger。

## Risks

- 如果 ledger 在提交后写入，自动 PR 不会包含记录。
- 如果安全扫描失败后仍写 resolved，会误导人类。
- 如果无修复也强制提交 ledger，可能产生噪音提交。

## Steps

1. 先写 e2e 红灯测试，要求 docs 开启时生成 `docs/auto-review-ledger.md`。
2. 新增 `ReviewLedgerEntryInput` 和 `review_record_path` JSON 字段。
3. 在 repo 层新增 ledger markdown 构建与追加函数。
4. 在 runtime 中于 `enforce_review_policy` 后、反馈提交前写入 ledger。
5. 更新约束、使用文档和质量分。
6. 运行目标测试、全量 codex-cli 测试、clippy 与 diff check。
