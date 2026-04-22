# GitHub Actions 与 Codex CLI 集成参考 (Workflow Integration)

版本：v1.1 | 最后更新：2026-04-21

## 1. 触发配置 (Trigger)
工作流由 `issue_comment` 触发，且仅当满足以下条件时执行：
- 评论属于 `pull_request`。
- 评论作者为 `gemini-code-assist[bot]`。
- 评论包含标记 `## Gemini Code Assist Review`。

## 2. 核心步骤详解

### 2.1 轮次探测 (Round Detection)
通过 `gh pr view --json labels` 获取当前 PR 的轮次标签：
- `gemini-review-round-1` (起始)
- `gemini-review-round-2`
- `gemini-review-round-max` (终止)

### 2.2 情报安全注入 (Safe Injection)
使用中间环境变量 `RAW_COMMENT_BODY` 并配合 GitHub Actions 的 `EOF` 语法安全注入多行 Review 文本：
```yaml
env:
  RAW_COMMENT_BODY: ${{ github.event.comment.body }}
run: |
  echo "REVIEW_BODY<<EOF" >> $GITHUB_ENV
  echo "$RAW_COMMENT_BODY" >> $GITHUB_ENV
  echo "EOF" >> $GITHUB_ENV
```

### 2.3 CLI 调用 (Codex CLI)
调用 `codex pr-auto-fix` 时需传递 `--yes` 参数以跳过交互确认，并指定 `--max-rounds`：
```bash
codex pr-auto-fix \
  --pr-number ${{ github.event.issue.number }} \
  --gemini-review "$REVIEW_BODY" \
  --max-rounds ${{ env.MAX_ROUNDS }} \
  --yes
```

> 说明：本地手动执行时若不传 `--yes`，CLI 会进入 Dry-Run 模式：仅在 PR 留评论说明“已生成但未推送”，不执行提交与推送。

## 3. 状态回传 (State Feedback)
CLI 运行结果以 JSON 格式输出，工作流通过 `jq` 解析状态：
- `fixed`: 布尔值，指示是否应用了修复。
- `files`: 修复/写入的文件列表（包含 `docs/CHANGELOG.md` 以保证可追溯）。
- `security_passed`: 布尔值，指示安全审计是否通过。
- `quality_score`: 0-100，指示本轮自动修复的质量评分。
- `summary`: GPT-5.4 对 Gemini 意见的结构化总结。

## 4. 故障排除 (Troubleshooting)
- **Git Push 失败**: 确保 Runner 环境已配置 `git config user.name` 和 `email`。
- **解析 JSON 失败**: 检查 Gemini 评论中是否包含非标准 Markdown 块或超长文本（超出 4000 tokens）。
- **轮次循环**: 检查 PR 标签是否被正确移除和添加。
