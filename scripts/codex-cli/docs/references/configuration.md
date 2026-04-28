## 配置与策略

### 必要环境变量

`codex-cli` 通过 OpenAI 兼容 Chat Completions API 调用模型：

- `OPENAI_API_KEY`：必填

建议本地使用 `.env`：

```env
OPENAI_API_KEY=...
OPENAI_API_BASE=https://api.openai.com/v1
CODEX_MODEL=gpt-4-turbo-preview
```

实现：

- [llm.rs](file:///Users/tyone/github/upload-download-util/scripts/codex-cli/src/llm.rs)
- [config.rs](file:///Users/tyone/github/upload-download-util/scripts/codex-cli/src/config.rs)

### 可选环境变量（模型与网关）

- `OPENAI_API_BASE`：默认 `https://api.openai.com/v1`
- `CODEX_MODEL`：默认 `gpt-4-turbo-preview`

### 自动修复筛选策略（跨仓库可配置）

`DecisionSkill` 会对解析后的 issues 做“硬过滤”，默认行为是：

- 仅处理 `Critical/High/Medium`
- 排除高风险文件（锁文件/配置文件/.env 等）
- 默认排除 `docs/` 与 `.md`（避免自动改文档造成 review 噪声与误改）

你可以用环境变量覆盖：

- `CODEX_ALLOWED_SEVERITIES`：逗号分隔，默认 `Critical,High,Medium`
  - 例：`CODEX_ALLOWED_SEVERITIES=High,Medium`
- `CODEX_PROTECTED_FILES`：额外受保护文件（逗号分隔），会追加到默认列表
  - 例：`CODEX_PROTECTED_FILES=go.mod,go.sum`
- `CODEX_EXCLUDE_DOCS`：是否排除文档路径，默认 `true`
  - `false/0` 表示允许处理 docs

实现：

- [skills.rs:decide_fix_or_skip](file:///Users/tyone/github/upload-download-util/scripts/codex-cli/src/skills.rs#L390-L441)

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

### PR 评论（可选）

PR 模式默认会发布评论：

- Dry-Run：说明已生成并应用补丁，但未推送
- Push：说明已修复文件、质量评分、安全扫描结果

禁用方式：

- CLI：`--no-pr-comments`
- 本地模式：默认不评论（`enable_pr_comments=false`）

依赖：

- 需要安装并登录 `gh`，且 runner 有权限对该 PR 评论

