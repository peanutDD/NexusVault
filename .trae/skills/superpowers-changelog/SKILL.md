---
name: "superpowers-changelog"
description: "Appends each AI code change into docs/CHANGELOG.md and wires it into the Superpowers Pipeline. Invoke when user asks to make changes traceable or to add a documentation step to pr-auto-fix."
---

# Superpowers Changelog（变更入档 Skill）

本 Skill 负责把“每次变更”变成可追溯的工程事实，并且以 **可复用模块** 的方式接入 Superpowers 的 Pipeline 编排。

## 适用时机（何时调用）

- 用户要求“每次改动都写进文档 / 变更可追溯 / 能复盘 AI 改了什么”
- 需要把“更新 CHANGELOG”作为流水线的一个步骤（插拔式）
- 需要让 GitHub Actions 能通过 JSON 输出稳定识别 `fixed/files`

## 核心约束

- 记录写入 **docs/CHANGELOG.md** 的 `## [未发布]` 区域下（若缺少 `### 🤖 AI 自动修复` 则创建）
- 记录内容包含：PR 编号、轮次、变更文件清单、安全审计结果、质量评分
- 变更记录必须被纳入提交文件集合，确保与代码变更同一次提交

## 推荐实现（Rust / codex-cli）

### 1) 新增 DocumentationSkill（可复用模块）

- 在 `SkillContext.fixed_files` 非空时，追加写入 `docs/CHANGELOG.md`
- 并将 `docs/CHANGELOG.md` 加入 `fixed_files`，保证后续 `git add` 包含该文件

参考实现位置：
- scripts/codex-cli/src/main.rs（DocumentationSkill + update_changelog）

### 2) Pipeline 编排接入（插拔式）

把该 Skill 放在 “修复之后、提交之前”：

- ReadReviewSkill
- DecisionSkill
- BatchFixSkill
- SecurityCheckSkill
- QualityScoreSkill
- DocumentationSkill  ← 本 Skill
- FeedbackSkill

### 3) 输出契约（给 Workflow 用）

确保 `pr_auto_fix` 返回 JSON 至少包含：

- `fixed`: boolean
- `files`: string[]
- `security_passed`: boolean
- `quality_score`: number

## 验证清单

- `cargo fmt --check`
- `cargo clippy -- -D warnings`
- `cargo test`
