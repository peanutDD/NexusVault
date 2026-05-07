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

你可以用环境变量覆盖：

- `CODEX_ALLOWED_SEVERITIES`：逗号分隔，默认 `Critical,High,Medium+,Medium`
  - 例：`CODEX_ALLOWED_SEVERITIES=High,Medium`（仍包含字面量 `Medium+`）
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
- 未修复：`Medium/Medium+` 及以上问题必须说明原因；禁用评论时写入最终 JSON 的 `pending_explanations`

禁用方式：

- CLI：`--no-pr-comments`
- 本地模式：默认不评论（`enable_pr_comments=false`）

依赖：

- 需要安装并登录 `gh`，且 runner 有权限对该 PR 评论
