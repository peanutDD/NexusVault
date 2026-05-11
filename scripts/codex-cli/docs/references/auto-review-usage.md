# 自动 Review 使用说明

本文档说明如何运行「Gemini Code Assist Review + 本地 Codex GPT-5.5 自动修复」闭环。

## 目标流程

1. 开发者提交 PR。
2. Gemini Code Assist 在 PR 中生成 Review 评论。
3. `.github/workflows/codex-auto-fix.yml` 监听 Gemini 评论。
4. self-hosted runner 拉取 PR 分支，调用 `codex-auto-fix pr-auto-fix`。
5. `scripts/codex-cli` 解析 Review，筛选 `Critical/High/Medium+/Medium` 问题。
6. 本地 Codex GPT-5.5 生成 unified diff，`git apply` 应用补丁。
7. 安全审计、质量评分、changelog 记录通过后，自动 commit/push。
8. 若本轮解决了 `Critical/High/Medium+/Medium` 问题，写入 `docs/auto-review-ledger.md`，逐条记录 Gemini 问题、Codex 状态、解决答案和修改文件。
9. workflow 根据标签最多请求第二轮 Gemini Review。
10. 人类查看最终 diff、评论和本地 ledger，决定 merge 或重跑。

## 前置条件

- 仓库启用 Gemini Code Assist。
- 本地机器注册 GitHub self-hosted runner，且拥有 workflow 中的 `file-server` 标签。
- runner 用户可执行：
  - `git`
  - `gh`
  - `jq`
  - `cargo` 或已安装好的 `codex-auto-fix` 二进制
  - 本地 Codex GPT-5.5 CLI
- runner 有 PR 分支 push 权限。
- `gh` 可用 `GITHUB_TOKEN` 对 PR 评论、改标签。

## 安装 codex-cli

在 runner 上安装本工具：

```bash
cd /path/to/upload-download-util/scripts/codex-cli
cargo install --path .
```

安装后会生成 `codex-auto-fix` 自动修复入口，也保留兼容入口 `codex`。workflow 使用 `codex-auto-fix`，真实 Codex GPT-5.5 CLI 由 `CODEX_AGENT_COMMAND` 指定。

注意：不要让 `CODEX_AGENT_COMMAND` 指向 `codex-auto-fix` 或同一路径下的兼容入口 `codex`。否则自动修复器会调用自己，形成递归。代码会检测这种情况并 fail-fast。

## 配置本地 Codex 命令

推荐在 GitHub Actions repository variable 或 self-hosted runner 环境中配置：

```bash
CODEX_AGENT_COMMAND="codex exec --skip-git-repo-check -"
CODEX_AGENT_TIMEOUT_SECONDS=900
```

如果你的真实 Codex CLI 不叫 `codex`，请写绝对路径或专用别名：

```bash
CODEX_AGENT_COMMAND="/usr/local/bin/codex-gpt55 exec --skip-git-repo-check -"
```

`CODEX_AGENT_COMMAND` 支持三种输入方式：

- 无占位符：prompt 写入 stdin。
- `{prompt}`：prompt 作为一个命令参数。
- `{prompt_file}`：prompt 写入临时文件，命令接收文件路径。

## GitHub Actions 配置

主 workflow 是：

```text
.github/workflows/codex-auto-fix.yml
.github/workflows/gemini-review-kickoff.yml
```

关键配置：

- `MAX_ROUNDS=2`：默认最多两轮 Gemini Review。
- `GEMINI_BOT=gemini-code-assist[bot]`：只监听 Gemini 的评论。
- `GEMINI_TRIGGER_MARKER=## Gemini Code Assist Review`：只处理 Review 正文。
- `concurrency`：同一 PR 自动修复串行执行，避免 runner 并发改同一分支。

workflow 支持三种 `CODEX_AGENT_COMMAND` 来源：

1. repository secret `CODEX_AGENT_COMMAND`
2. repository variable `CODEX_AGENT_COMMAND`
3. self-hosted runner 已存在的环境变量

## 环境变量配置

### 必要配置

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `CODEX_AGENT_COMMAND` | 本地 Codex 执行命令 | 必填 |
| `CODEX_AGENT_TIMEOUT_SECONDS` | 单次调用超时（秒） | 900 |

### 筛选策略配置

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `CODEX_ALLOWED_SEVERITIES` | 允许自动修复的严重级别 | `Critical,High,Medium+,Medium` |
| `CODEX_PROTECTED_FILES` | 额外受保护文件（逗号分隔） | 空 |
| `CODEX_EXCLUDE_DOCS` | 是否排除文档路径 | `true` |

### CI 环境变量（自动设置）

| 变量 | 说明 |
|------|------|
| `GITHUB_REPOSITORY` | 仓库标识（如 `owner/repo`） |
| `GITHUB_WORKSPACE` | 工作目录路径 |
| `GITHUB_TOKEN` | GitHub 访问令牌 |

## 标准运行

1. 打开 PR。
2. workflow 会自动评论 `/gemini review` 请求第一轮 Gemini Review。
3. Gemini 发布 Review 后，`codex-fix` job 自动启动。
4. 如果有可修复的 `Critical/High/Medium+/Medium` 问题，Codex 修复并 push。
5. 第一轮清洁或成功推送修复后，workflow 将标签推进到 `gemini-review-round-2`，并再次评论 `/gemini review`。
6. 第二轮清洁或成功推送修复后，workflow 将标签推进到 `gemini-review-round-max`；若没有 pending，同时添加 `gemini-review-clean`。
7. 如果 `pending_explanations` 非空且本轮没有任何修复，workflow 添加 `gemini-review-needs-human`，不会发布“无需修复/建议合并”的误导评论。
8. 人类做最终 Review 并决定是否 merge。

## 自动修复策略

默认只处理：

- `Critical`
- `High`
- `Medium+`
- `Medium`

默认跳过：

- `Low`
- 锁文件：`Cargo.lock`、`package-lock.json`、`bun.lock`
- 包管理配置：`Cargo.toml`、`package.json`、`pyproject.toml`
- 敏感配置：`.env`
- 文档路径：`docs/`、`*.md`

可用环境变量调整：

```bash
CODEX_ALLOWED_SEVERITIES=Critical,High,Medium+,Medium
CODEX_PROTECTED_FILES=go.mod,go.sum
CODEX_EXCLUDE_DOCS=true
```

## 输出 JSON

`pr-auto-fix` 的 stdout 只输出 JSON，workflow 用 `jq` 解析：

```json
{
  "fixed": true,
  "files": ["src/a.rs"],
  "quality_score": 95,
  "quality_score_available": true,
  "security_passed": true,
  "push_blocked": false,
  "has_pending": false,
  "pending_count": 0,
  "review_clean": true,
  "summary": "Gemini review summary",
  "review_record_path": "docs/auto-review-ledger.md",
  "fixed_explanations": [],
  "pending_explanations": [],
  "issue_statuses": [
    {
      "severity": "Medium",
      "file": "src/a.rs",
      "line": 12,
      "description": "Gemini issue text",
      "status": "resolved",
      "explanation": "已自动修复"
    }
  ]
}
```

字段含义：

- `fixed=true`：本轮有变更且已允许进入后续轮次。
- `review_record_path`：本轮写入的本地逐项处理台账；无可记录问题或禁用文档记录时为 `null`。
- `issue_statuses`：Gemini 每条 `Medium/Medium+/High/Critical` 问题的一一对应状态。

## 本地处理台账

默认情况下，`codex-auto-fix` 会在修复提交前追加 `docs/auto-review-ledger.md`，并同步追加 `docs/auto-review-ledgers/pr-<number>.md`（本地运行写入 `docs/auto-review-ledgers/local.md`）。这些文件不是汇总 changelog，而是逐项诊断记录：

- Gemini 提出的问题是什么。
- 问题位于哪个文件和行。
- Codex 标记为 `resolved`、`pending` 还是 `blocked`。
- 已解决时的答案，例如“已自动修复”。
- 未解决或阻塞时的原因。
- 本轮修改了哪些文件。

`--disable-changelog` 会同时关闭 changelog 和 ledger 写入，主要用于测试或不希望产生文档变更的本地运行。
- `fixed=false`：没有变更，或变更被安全门禁拦截。
- `push_blocked=true`：生成了变更，但安全审计 fail-closed，未 commit/push。
- `has_pending=true` / `pending_count>0`：仍有 `Medium/Medium+/High/Critical` 问题没有自动修复，PR 不可视为 clean。
- `review_clean=true`：当前 Codex 解析出的 `Medium/Medium+/High/Critical` 问题全部修复或不存在，且未被安全门禁阻断。
- `issue_statuses`：当前 Gemini Review 中每个 `Medium/Medium+/High/Critical` 问题的一一对应状态；PR 评论会用同一份数据渲染 `Medium/Medium+/High/Critical 对应状态` 表。
- `fixed_explanations`：`Medium/Medium+/High/Critical` 问题已自动修复时的 issue 级说明。
- `pending_explanations`：`Medium/Medium+/High/Critical` 问题未修复时的原因。
- `quality_score_available=false`：质量评分不可用，不等于真实 0 分。

## 安全门禁

自动修复必须满足：

- patch 必须是 unified diff，且包含 `@@` hunk。
- patch 只能通过 `git apply` 应用，不能直接覆盖文件。
- `git` / `gh` 命令非零退出码会直接失败。
- 安全审计输出必须是严格 JSON；解析失败视为未通过。
- `security_passed=false` 时，不允许 commit/push，只能评论原因。
- 自动修复提交不得使用 `[skip ci]`，必须触发 CI；`gemini-review-kickoff` 会跳过 `codex auto-fix` 提交，避免重复 Gemini 请求。

## 人工合并标准

建议满足以下条件再合并：

- PR 带有 `gemini-review-round-max` 和 `gemini-review-clean`，或 `gemini-review-needs-human` 中的问题已人工接受/处理。
- Gemini 第二轮没有新的 `Medium/Medium+/High/Critical` 问题，或第二轮发现的问题已被 Codex/人工处理。
- PR 没有 `push_blocked=true` 的 Codex 评论。
- `pending_explanations` 中的问题都被接受，或已经人工处理。
- CI 通过。
- 人类看过最终 diff。

## 重跑方式

如果需要重新进入自动修复：

1. 删除 `gemini-review-round-max` 标签。
2. 添加或保留 `gemini-review-round-1`。
3. 在 PR 评论 `/gemini review`。

## 常见故障

- `CODEX_AGENT_COMMAND` 未设置：配置 repository secret/variable，或在 runner 环境中导出。
- 递归调用：`CODEX_AGENT_COMMAND` 指向了本工具自身，需要改成真实 Codex GPT-5.5 CLI。
- Codex 超时：调大 `CODEX_AGENT_TIMEOUT_SECONDS`，并检查 runner 上 Codex 登录状态。
- `git apply` 失败：Gemini 评论基于过期代码，重新请求 Review。
- `gh pr comment` 失败：检查 token 权限和 `gh` 登录。
- 安全审计阻断：查看 PR 中 Codex 的 fail-closed 评论，人工处理后再重跑。

## 本地调试

可以使用 `AutoFixLocal` 命令在本地测试自动修复流程：

```bash
codex-auto-fix auto-fix-local \
  --repo-root /path/to/repo \
  --review-file /path/to/review.md \
  --yes
```

参数说明：

- `--repo-root`：目标仓库根目录
- `--review-file`：包含 Gemini Review 内容的文件
- `--yes`：自动提交并推送（不加则为 Dry-Run 模式）
- `--disable-changelog`：禁用 changelog 更新
- `--rules-file`：指定自定义规则文件
