## 配置与策略

### 必要环境变量

`codex-cli` 通过本地 Codex 命令调用模型，**不依赖任何外部 API（如 OpenAI/GPT）**：

- `CODEX_AGENT_COMMAND`：必填，本地 Codex 执行命令
- `CODEX_AGENT_TIMEOUT_SECONDS`：可选，单次 Codex 调用超时，默认 `900`

### 本地执行架构优势

**安全保证**
- 无任何网络 API 调用，代码和数据完全保留在本地
- 避免 API 泄露和网络传输风险
- 无需管理 API 密钥

**性能稳定**
- 不受外部服务限流影响
- 本地执行延迟更低
- 可以充分利用本地硬件加速

建议本地使用 `.env`：

```env
CODEX_AGENT_COMMAND=codex exec --skip-git-repo-check -
CODEX_AGENT_TIMEOUT_SECONDS=900
```

实现：

- [llm.rs](file:///Users/tyone/github/upload-download-util/scripts/codex-cli/src/llm.rs)

### Codex 命令输入方式

`CODEX_AGENT_COMMAND` 支持三种 prompt 传递方式：

- 不写占位符：完整 prompt 写入 stdin
- 使用 `{prompt}`：把完整 prompt 作为单个命令参数
- 使用 `{prompt_file}`：把完整 prompt 写入临时文件，并把文件路径作为参数

```env
CODEX_AGENT_COMMAND=codex exec --skip-git-repo-check -
CODEX_AGENT_COMMAND=codex exec --skip-git-repo-check {prompt}
CODEX_AGENT_COMMAND=codex exec --skip-git-repo-check --prompt-file {prompt_file}
```

注意：如果本工具自身也安装为 `codex`，不要把 `CODEX_AGENT_COMMAND` 指向同一个二进制，否则会递归调用。
代码会检测 `CODEX_AGENT_COMMAND` 是否解析到当前二进制；一旦发现递归风险，会直接失败。

### 自动修复筛选策略（跨仓库可配置）

`DecisionSkill` 会对解析后的 issues 做“硬过滤”，默认行为是：

- 仅处理 `Critical/High/Medium+/Medium`
- 排除高风险文件（锁文件/配置文件/.env 等）
- 默认排除 `docs/` 与 `.md`（避免自动改文档造成 review 噪声与误改）

GitHub workflow 默认开启严格治理：`CODEX_AUTO_FIX_STRICT=true`。任何
`Medium/Medium+/High/Critical` 问题只要不是 `resolved`，就不得进入
`gemini-review-clean` 或 `ready_to_merge=true`。外力失败、策略过滤、
发布失败都必须保留为阻塞状态，并给出具体原因和解决办法。

你可以用环境变量覆盖：

- `CODEX_ALLOWED_SEVERITIES`：逗号分隔，默认 `Critical,High,Medium+,Medium`
  - 例：`CODEX_ALLOWED_SEVERITIES=High,Medium`（仍包含字面量 `Medium+`）
- `CODEX_PROTECTED_FILES`：额外受保护文件（逗号分隔），会追加到默认列表
  - 例：`CODEX_PROTECTED_FILES=go.mod,go.sum`
- `CODEX_EXCLUDE_DOCS`：是否排除文档路径，默认 `true`
  - `false/0` 表示允许处理 docs

实现：

- [skills.rs:decide_fix_or_skip](file:///Users/tyone/github/upload-download-util/scripts/codex-cli/src/skills.rs#L390-L441)

### 补丁格式策略

`BatchFixSkill` 默认要求模型输出 SEARCH/REPLACE block，并保留 unified diff 兼容路径。

SEARCH/REPLACE 格式：

```text
### File: src/lib.rs
<<<<<<< SEARCH
old code
=======
new code
>>>>>>> REPLACE
```

相关环境变量：

- `CODEX_SR_MAX_BLOCKS`：单个 issue 允许的最大 block 数，默认 `5`
- `CODEX_FULL_FILE_FALLBACK_ALLOWED_PREFIXES`：完整文件兜底允许前缀，默认 `src/,backend/src/,frontend/src/,scripts/,.github/scripts/`
- `CODEX_PROTECTED_FILES`：完整文件兜底保护文件，默认包含锁文件、包管理配置和 `.env`

行为：

- SEARCH/REPLACE 是主路径，避免 LLM 直接生成易损坏的 hunk header。
- unified diff 输出仍会自动识别并走 `git apply` 兼容路径。
- 如果本轮没有任何文件被修复，SecurityCheck / QualityScore / Documentation 会跳过；最终 JSON 的 `quality_score_available=false` 并带 skip 原因。
- `git push` 与 `gh pr comment` 遇到 `Empty reply from server`、连接超时、断连等 transient 网络错误会自动重试 3 次。

### 规则文件（AGENTS.md 注入）

Patch 生成时会把规则注入 system prompt（用于限制越权修改/架构违规/不安全操作）。

规则来源优先级：

1. `--rules-file /abs/path/to/rules.md`
2. `<repo_root>/AGENTS.md`
3. 内置兜底（保证 CLI 可运行）

实现：

- [repo.rs:read_rules](file:///Users/tyone/github/upload-download-util/scripts/codex-cli/src/repo.rs#L52-L75)
- [skills.rs:generate_fix_patch](file:///Users/tyone/github/upload-download-util/scripts/codex-cli/src/skills.rs#L443-L476)

### changelog（可选）

默认会尝试把本轮修复写入 `<repo_root>/docs/CHANGELOG.md` 的 `### 🤖 AI 自动修复` 小节下。

跨仓库场景常见两种方式：

- 显式指定：`--changelog-path docs/CHANGELOG.md`（相对路径会基于 repo_root 拼接）
- 禁用：`--disable-changelog`

实现：

- [repo.rs:update_changelog](file:///Users/tyone/github/upload-download-util/scripts/codex-cli/src/repo.rs#L106-L139)
- [repo.rs:append_ai_changelog_in](file:///Users/tyone/github/upload-download-util/scripts/codex-cli/src/repo.rs#L187-L214)
- [skills.rs:DocumentationSkill](file:///Users/tyone/github/upload-download-util/scripts/codex-cli/src/skills.rs#L211-L244)

### auto review ledger（默认开启）

当本轮解析到 Gemini Review 问题时，默认追加两份 ledger，即使没有源码文件被自动修复：

- `<repo_root>/docs/auto-review-ledger.md`：全局追加记录，保留跨 PR 时间线。
- `<repo_root>/docs/auto-review-ledgers/pr-<number>.md`：按 PR 归档；本地运行写入 `docs/auto-review-ledgers/local.md`。

该 ledger 是完整 PR review 审计记录，不替代 PR 评论：

- 记录 Gemini 原问题、严重级别、文件和行号。
- 记录 Gemini 建议、约束和该 issue 是否进入自动修复范围。
- 记录 Codex 对应状态：`resolved`、`pending_fix_failed`、`blocked_external`、`blocked_policy`、`blocked_push`、`tracked`。
- 记录修复方式、失败原因、失败阶段、是否可重试、被阻止动作、解决答案或未解决原因。
- 记录关联文件；Low/Info 默认只做 `tracked` 审计，不进入 pending 阻塞。

`--disable-changelog` 会同时禁用 changelog 与 ledger，避免测试或临时本地运行产生文档变更。

### PR 评论（可选）

PR 模式默认会发布评论：

- Dry-Run：说明已生成并应用补丁，但未推送
- Push：说明已修复文件、质量评分、安全扫描结果，并按 issue 展示“已自动修复问题”
- 发布阻塞：如果 pre-push 验证、`git commit`、`git push`、GitHub API fallback 或 PR 评论失败，评论必须说明具体阶段、原始错误摘要、被阻止动作和解决办法。
- 未修复：`Medium/Medium+/High/Critical` 问题必须说明原因；禁用评论时写入最终 JSON 的 `pending_explanations`
- 对应状态：每次解析到 Gemini Review 后，评论必须包含 `Medium/Medium+/High/Critical 对应状态` 表，将每个 Gemini issue 一一标记为已解决、未解决、外力阻塞、策略阻塞或推送阻塞
- JSON：`issue_statuses`、`fixed_explanations` 与 `pending_explanations` 必须让人类和 workflow 能区分已修复、未修复和停止原因

禁用方式：

- CLI：`--no-pr-comments`
- 本地模式：默认不评论（`enable_pr_comments=false`）

依赖：

- 需要安装并登录 `gh`，且 runner 有权限对该 PR 评论
