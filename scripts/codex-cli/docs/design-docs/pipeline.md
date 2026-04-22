## Pipeline / Skills 设计

`codex-cli` 的核心是一个小型编排器：`Pipeline` 顺序执行多个 `Skill`，并通过 `SkillContext` 共享状态。

代码入口：

- [pipeline.rs](file:///Users/tyone/github/upload-download-util/scripts/codex-cli/src/pipeline.rs)
- [skills.rs](file:///Users/tyone/github/upload-download-util/scripts/codex-cli/src/skills.rs)
- [runtime.rs](file:///Users/tyone/github/upload-download-util/scripts/codex-cli/src/runtime.rs)

### SkillContext（共享上下文）

`SkillContext` 是流水线的“可变状态容器”。初始化参数集中在 `SkillContextInit`：

- `pr_number`：用于 changelog 与 PR 评论（本地模式为 0）
- `repo_root`：目标仓库根目录（所有读写与 git 操作都基于它）
- `rules_text`：注入模型的规则文本（来自 `--rules-file` / `AGENTS.md` / 兜底）
- `raw_input`：原始 review 文本
- `auto_push`：是否允许提交/推送（由 `--yes` 控制）
- `enable_pr_comments`：是否允许 PR 评论（PR 模式可禁用）
- `changelog_path` / `disable_changelog`：changelog 策略

定义：

- [skills.rs:SkillContext](file:///Users/tyone/github/upload-download-util/scripts/codex-cli/src/skills.rs#L14-L64)

### Pipeline 顺序（默认）

默认顺序在运行时拼装：

1. `ReadReviewSkill`：解析 review → `ReviewData`
2. `DecisionSkill`：筛选允许修复的 issues
3. `BatchFixSkill`：为每条 issue 生成 patch 并尝试 `git apply`
4. `SecurityCheckSkill`：prompt-based 软审计（遇到疑似风险则标记失败）
5. `QualityScoreSkill`：质量评分（0-100）
6. `DocumentationSkill`：可选写入 changelog
7. `DryRunFeedbackSkill`：未 push 时可选发 PR 评论
8. `FeedbackSkill`：push/评论/或输出“无需修复”

### 为什么不用“循环修复”

当前实现更偏向“单轮批处理”：

- 优点：可控、可预测；避免一次失败导致整轮终止；更适合 CI
- 缺点：无法自动重试“冲突/上下文不足”的 patch

如果未来需要多轮，可把 `rounds` 语义扩展为“最多 N 轮”，并在 `runtime` 层循环执行 Pipeline。

### 如何新增 Skill（扩展点）

1. 在 [skills.rs](file:///Users/tyone/github/upload-download-util/scripts/codex-cli/src/skills.rs) 中新增 `struct XxxSkill;` 并实现 `Skill` trait
2. 明确该 Skill 读取/写入 `SkillContext` 的哪些字段（避免隐式耦合）
3. 在 [runtime.rs](file:///Users/tyone/github/upload-download-util/scripts/codex-cli/src/runtime.rs) 的 Pipeline 拼装处插入该 Skill

建议的 Skill 设计约束：

- 单一职责：一个 Skill 做一件可解释的事
- 可失败：失败应返回 error（让 CI 感知），或显式选择“跳过该条”并记录日志
- 不污染 stdout：日志只写 stderr（保持 JSON 输出稳定）

