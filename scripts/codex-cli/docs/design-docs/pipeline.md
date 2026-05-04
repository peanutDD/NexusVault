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

运行时把“当前 Gemini Review 的一次修复”和“最终反馈”拆开。执行顺序：

1. `ReadReviewSkill`：解析 review → `ReviewData`
2. `DecisionSkill`：筛选允许修复的 issues
3. `BatchFixSkill`：为每条 issue 生成 patch 并尝试 `git apply`
4. `SecurityCheckSkill`：严格 JSON 软审计，解析失败 fail-closed
5. `QualityScoreSkill`：质量评分（0-100），解析失败会重试并标记不可用
6. `DocumentationSkill`：可选写入 changelog，记录 `current_round`

循环结束后统一执行：

1. `enforce_review_policy`：medium+ 未修复必须生成原因
2. `DryRunFeedbackSkill`：未 push 时可选发 PR 评论
3. `FeedbackSkill`：push/评论/或输出未修复说明

### 轮次边界

`max_rounds` 只表示外层 PR Review 的轮次上限，默认 2。单次 `pr-auto-fix` 调用只处理当前这一条 Gemini Review；下一轮必须由 workflow 标签升级后重新请求 Gemini Review，再用新的评论触发。

`SkillContext` 同时保留 `max_rounds` 与 `current_round`，避免把配置上限误写成当前执行轮次。

### 可观测输出

- `fix_attempts` 记录每条 issue 的补丁生成/应用阶段、成功状态与失败原因
- `security_findings` 记录安全审计失败原因
- `quality_score_available` 区分“评分为 0”和“评分不可用”
- `pending_explanations` 记录 medium+ 未修复原因；禁用 PR 评论时会进入最终 JSON
- `has_pending` / `pending_count` / `review_clean` 让 workflow 状态机区分 clean、pending 与安全阻断

### 如何新增 Skill（扩展点）

1. 在 [skills.rs](file:///Users/tyone/github/upload-download-util/scripts/codex-cli/src/skills.rs) 中新增 `struct XxxSkill;` 并实现 `Skill` trait
2. 明确该 Skill 读取/写入 `SkillContext` 的哪些字段（避免隐式耦合）
3. 在 [runtime.rs](file:///Users/tyone/github/upload-download-util/scripts/codex-cli/src/runtime.rs) 的 Pipeline 拼装处插入该 Skill

建议的 Skill 设计约束：

- 单一职责：一个 Skill 做一件可解释的事
- 可失败：失败应返回 error（让 CI 感知），或显式选择“跳过该条”并记录日志
- 不污染 stdout：日志只写 stderr（保持 JSON 输出稳定）
