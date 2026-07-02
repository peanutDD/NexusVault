## 故障排查

### 1) 启动即报错：请设置 CODEX_AGENT_COMMAND

原因：`codex-cli` 只调用本地 Codex 命令，不使用 GPT/OpenAI API；缺少本地命令配置会直接失败，避免“静默空跑”。

处理：

- 本地：创建 `scripts/codex-cli/.env` 并写入 `CODEX_AGENT_COMMAND=codex exec --skip-git-repo-check -`
- CI：配置 secrets，并在 job 环境里导出

### 2) 本地 Codex 命令失败

处理顺序：

1. 确认 `CODEX_AGENT_COMMAND` 指向真实的本地 Codex CLI，而不是本工具自身
2. 确认 runner 用户已登录/授权本地 Codex
3. 确认命令支持 stdin，或改用 `{prompt}` / `{prompt_file}` 占位符

### 3) 解析 Gemini Review JSON 失败

现象：报错包含 `解析 Gemini Review JSON 失败`，并附带模型原始输出。

原因：`ReadReviewSkill` 需要模型严格输出 JSON；若模型输出夹杂解释文字，会导致反序列化失败。

处理：

- 确认输入的 Gemini Review 文本完整且未截断
- 尝试更换/固定模型（例如更稳定的 JSON 输出模型）
- 将 Gemini Review 先保存为文件，减少 shell 转义影响

### 4) 没有修复任何文件（fixed=false）

常见原因：

- issue 严重级别不在允许列表里（默认只处理 Critical/High/Medium）
- 命中受保护文件（默认排除锁文件、配置文件、`.env` 等）
- 默认排除 docs 与 `.md`

处理：

- 调整环境变量：
  - `CODEX_ALLOWED_SEVERITIES=High,Medium`
  - `CODEX_EXCLUDE_DOCS=false`
  - `CODEX_PROTECTED_FILES=...`

### 5) SEARCH/REPLACE 无法应用

原因：模型输出的 SEARCH 块在目标文件里没有唯一匹配，常见于代码已经漂移、上下文太短或同一片段出现多次。

处理：

- 确认 review 指向的是当前工作区里的最新代码。
- 让模型扩大 SEARCH 块上下文，至少包含前后各 3 行稳定代码。
- 如果路径命中保护规则，完整文件兜底会被阻止，需要人类处理。

### 6) git apply 失败

原因：patch 的上下文与当前工作区不匹配，或者模型输出的 patch 不合法。

处理：

- 确认 `repo_root` 指向的工作区就是你要修复的仓库
- 确认 review 里的文件路径与仓库路径一致
- 如果 issue 已过期（代码已变化），需要重新生成 review
- unified diff 只是兼容路径；新问题优先让模型输出 SEARCH/REPLACE block

### 7) 没有任何修复但出现 pending / blocked

当 `selected_issues > 0` 且 `fixed_files = 0` 时，运行时会跳过 SecurityCheck / QualityScore / Documentation，并在最终 JSON/PR 评论中保留未修复原因。这样避免对原始未修复代码误打质量分。

状态含义：

- `pending_fix_failed`：Codex 已尝试，但补丁生成、应用、重试或完整文件兜底没有修好。处理：检查目标文件和 Codex 输出，必要时人工修复，或手动触发第 3 轮/更多轮。
- `blocked_external`：断网、Codex 额度不足/超时、GitHub 连接失败、runner 中断、Gemini 未返回等外力因素。处理：恢复外部条件后手动触发下一轮。
- `blocked_policy`：受保护文件、docs 默认过滤、危险路径或策略限制。处理：人工批准策略变更、调整 `CODEX_EXCLUDE_DOCS` / `CODEX_PROTECTED_FILES`，或人工修复。
- `blocked_push`：本地修复已生成，但 pre-push 验证、`git commit`、`git push`、GitHub API fallback 或 PR 评论失败。处理：按 `failure_stage` 和 `failure_reason` 修复后重跑。

### 8) blocked_push：验证/提交/推送失败

必须先看 PR 评论或 ledger 中的字段：

- `failure_stage`：失败阶段，例如 `pre-push validation`、`git commit`、`git push`、`GitHub API fallback`、`PR comment`。
- `failure_reason`：原始错误摘要。
- `blocked_action`：被阻止的动作。
- `remediation`：可执行解决办法。

常见处理：

- `pre-push validation`：本地执行 `CODEX_AUTO_FIX_VERIFY_COMMANDS` 对应的 lint/typecheck/test/format 命令，修复失败后重跑。
- `git push` 或 GitHub API fallback：检查网络、branch protection、`GITHUB_TOKEN` 权限和远端分支状态。
- `PR comment`：检查 `gh` 登录、token 权限、GitHub API 可用性；必要时先保留本地 ledger，再手动补评论或重跑。

### 9) PR 评论失败

原因：`gh` 未安装/未登录/权限不足。

处理：

- GitHub Actions：确保 runner 有 `gh`，并正确配置 token 权限
- 或直接禁用：`--no-pr-comments`
- 如果 stderr 包含 `Empty reply from server`、timeout 或 disconnect，工具会自动重试；三次后仍失败会标记为 `blocked_push` 或 `blocked_external`，并给出恢复办法

### 10) 需要第 3 轮或更多轮

默认自动闭环最多 2 轮。如果第 2 轮后仍未 clean：

1. 先按 `remediation` 处理根因。
2. 删除 `gemini-review-round-max` / `gemini-review-needs-human` 标签。
3. 添加 `gemini-review-round-3`；更多轮依次使用 `gemini-review-round-4`、`gemini-review-round-5`。
4. 评论 `/gemini review` 触发新一轮 Gemini Review。

### 11) changelog 写入失败或不希望写入

处理：

- 仓库没有 changelog：使用 `--disable-changelog`
- 或指定路径：`--changelog-path docs/CHANGELOG.md`
