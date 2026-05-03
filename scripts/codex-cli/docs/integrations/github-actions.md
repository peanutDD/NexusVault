## GitHub Actions 集成

`codex-cli` 的 PR 模式设计为“工作流可消费”的命令：stdout 输出 JSON，stderr 输出日志。

### 典型调用方式

在 job 里把 Gemini Review 文本整理成环境变量或文件，然后调用：

```bash
codex-auto-fix pr-auto-fix \
  --pr-number "${PR_NUMBER}" \
  --gemini-review "${GEMINI_REVIEW}" \
  --max-rounds 2 \
  --repo-root "${GITHUB_WORKSPACE}" \
  --yes
```

如果你希望关闭 PR 评论（只修复/推送）：

```bash
codex-auto-fix pr-auto-fix ... --no-pr-comments
```

### 输出（stdout）与多行写入

stdout 会输出 JSON 字符串，建议用 `jq` 拿字段并写入 `GITHUB_OUTPUT`：

```bash
RESULT="$(codex-auto-fix pr-auto-fix ...)"
echo "skill_result<<EOF" >> "$GITHUB_OUTPUT"
echo "$RESULT" >> "$GITHUB_OUTPUT"
echo "EOF" >> "$GITHUB_OUTPUT"
```

### 仓库根目录与规则/Changelog 参数化

跨仓库复用时，建议显式传这些参数，避免依赖固定文件结构：

```bash
codex-auto-fix pr-auto-fix \
  --pr-number "${PR_NUMBER}" \
  --gemini-review "${GEMINI_REVIEW}" \
  --repo-root "${GITHUB_WORKSPACE}" \
  --rules-file "${GITHUB_WORKSPACE}/AGENTS.md" \
  --changelog-path "docs/CHANGELOG.md"
```

如果目标仓库没有 changelog 或不希望写入：

```bash
codex-auto-fix pr-auto-fix ... --disable-changelog
```

### 权限与依赖

- `CODEX_AGENT_COMMAND` 必须可用（Actions Secrets 或 runner 环境变量）
- 如果启用 PR 评论：
  - runner 需要安装并登录 `gh`（或使用 `gh auth login` / `GITHUB_TOKEN`）
  - token 需要对 PR 有评论权限
- 如果启用推送（`--yes`）：
  - runner 需要具备 push 权限
  - 目标分支保护规则需要允许该身份推送
