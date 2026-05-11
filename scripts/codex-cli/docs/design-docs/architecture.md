## 架构与模块

### 目标

- 把“代码审查意见”变成可应用的变更（优先 SEARCH/REPLACE block，兼容 unified diff），并安全落地到工作区
- 支持两种运行形态：
  - GitHub PR（可选 PR 评论、可选推送）
  - 本地仓库（不依赖 GitHub / gh CLI）
- 通过参数化实现跨仓库复用：规则文本、规则文件、repo_root、changelog 路径均可配置

### 非目标

- 不做真正的静态安全扫描/AST 分析（当前安全检查是 prompt-based 的软审计）
- 不做复杂的多文件重构编排（目前以“按 issue 逐个 patch”优先）
- 不保证每条 issue 都能修复（单条失败会跳过，避免中断整轮流水线）

### 分层与依赖方向

项目遵循单向依赖（上层依赖下层），避免循环引用。模块职责如下：

- `types.rs`：数据结构与对外输出契约（ReviewData / ReviewIssue / PrAutoFixOutput 等）
- `llm.rs`：本地 Codex 命令执行器（读取 `CODEX_AGENT_COMMAND`，只负责调用与错误回传）
- `patch/`：模型补丁格式检测、SEARCH/REPLACE block 解析与应用
- `repo.rs`：仓库侧能力（读文件、unified diff 应用、提交推送、可选 gh 评论、changelog 更新）
- `skills.rs`：原子步骤（解析 review、决策、生成 patch、应用 patch、安全/质量评估、文档入档、反馈）
- `pipeline.rs`：Skill 编排器（顺序执行、上下文传递）
- `runtime.rs`：对外运行入口（PR 模式 / 本地模式），负责拼装 Pipeline 并构建上下文
- `src/bin/codex.rs`：CLI 解析与命令分发

对应代码：

- [lib.rs](file:///Users/tyone/github/upload-download-util/scripts/codex-cli/src/lib.rs)
- [runtime.rs](file:///Users/tyone/github/upload-download-util/scripts/codex-cli/src/runtime.rs)
- [skills.rs](file:///Users/tyone/github/upload-download-util/scripts/codex-cli/src/skills.rs)
- [repo.rs](file:///Users/tyone/github/upload-download-util/scripts/codex-cli/src/repo.rs)

### 数据流（Pipeline）

核心数据流（以 `pr-auto-fix` 为例）：

1. 输入：`gemini_review`（Markdown 文本，通常来自 PR Review 评论）
2. `ReadReviewSkill`：把 Markdown 转为严格 JSON，并反序列化为 `ReviewData`
3. `DecisionSkill`：根据策略筛选允许自动修复的问题（严重级别/受保护文件/是否排除 docs）
4. `BatchFixSkill`：
   - 对每条 issue 调用模型生成 SEARCH/REPLACE block
   - 自动检测 SEARCH/REPLACE、unified diff、空输出或未知输出
   - SEARCH/REPLACE 直接按单文件精确/行尾空白宽松匹配写回；unified diff 走兼容路径
   - 失败后先按同格式重试，再进入 SEARCH/REPLACE 兜底，最后才允许完整文件覆写
5. 如果没有任何修复文件，跳过 SecurityCheck / QualityScore / Documentation，避免对未修复代码误打分
6. `SecurityCheckSkill`：对已修改文件做 prompt-based 安全审计（软拦截/提示）
7. `QualityScoreSkill`：对本轮修复打质量分（0-100）
8. `DocumentationSkill`：可选把本轮修复落入 changelog（路径可配置、也可禁用）
9. `DryRunFeedbackSkill`：未传 `--yes` 时，进入 Dry-Run（可选发 PR 评论说明）
10. `FeedbackSkill`：在 `--yes` 时提交+推送，并可选发 PR 评论；若无修复，按 clean / pending 状态输出总结

### 关键设计点

**1）跨仓库可复用的 repo_root**

- 所有“读文件/写文件/执行 git”的操作都允许指定 `repo_root`
- 本地模式与 PR 模式都以 `repo_root` 为准，避免固定绑定 `GITHUB_WORKSPACE`

**2）规则注入（rules_text）**

- 修复 patch 生成的 system prompt 会注入规则文本（通常来自 `AGENTS.md`）
- 规则来源优先级：
  1. CLI 显式 `--rules-file`
  2. repo_root 下的 `AGENTS.md`
  3. 最小兜底规则（保证可用性）

**3）Patch 应用的安全性**

- 主路径使用 SEARCH/REPLACE block，避免 LLM 直接计算 unified diff hunk 行数
- 每个 block 必须声明 `### File: <allowed-file>`，只能作用于当前 issue 文件
- SEARCH 块必须唯一匹配；多匹配或零匹配会进入重试/兜底，而不是盲写
- unified diff 仅作为兼容路径；仍由 `git apply` 处理，临时文件放在系统 temp 目录
- 完整文件覆写只在受保护路径与允许前缀检查通过后使用

**4）输出契约稳定**

所有入口最终都会返回一段 JSON（stdout），用于 CI 稳定解析：

```json
{
  "fixed": true,
  "files": ["src/a.rs"],
  "quality_score": 95,
  "quality_score_available": true,
  "security_passed": true,
  "push_blocked": false,
  "pending_explanations": [],
  "has_pending": false,
  "pending_count": 0,
  "review_clean": true,
  "summary": "..."
}
```

### 可演进方向（不影响当前接口）

- 把 repo 能力进一步抽象为 Backend（Local / GhCli / API），以便替换实现而不改 skill
- 为 `SecurityCheckSkill` 引入可插拔扫描器（例如调用现有 SAST/secret scan）
- 引入“单轮多 issue 统一 patch”策略以降低冲突概率
