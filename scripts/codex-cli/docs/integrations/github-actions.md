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

### Review JSON 主输入

主修复链路使用结构化 Review JSON。先把 Gemini Review 写入临时文件，
再调用确定性转换命令；随后把 `/tmp/review.json` 传给 `pr-auto-fix --review-json`。
默认 `USE_REVIEW_JSON=true`。如转换器异常，可临时设置 `USE_REVIEW_JSON=false`
回滚到 `--gemini-review "$REVIEW_BODY"` Markdown 输入；转换失败时 workflow
会添加 `gemini-review-needs-human` 并停止。

```bash
printf '%s\n' "$REVIEW_BODY" > /tmp/review.md

cargo run --manifest-path scripts/codex-cli/Cargo.toml --bin codex-auto-fix -- \
  review-to-json \
  --input /tmp/review.md \
  --output /tmp/review.json

# 兼容入口：scripts/codex-cli/tools/review_to_json.sh --input /tmp/review.md --output /tmp/review.json

jq -e '.issues and (.issues | type == "array")' /tmp/review.json >/dev/null
echo "REVIEW_JSON_PATH=/tmp/review.json" >> "$GITHUB_ENV"
echo "review_issue_count=$(jq '.issues | length' /tmp/review.json)"
```

### 双入口 REVIEW_BODY 提取

`codex-auto-fix` workflow 同时监听 `issue_comment` 与 `pull_request_review`：

- `issue_comment`：直接使用 Gemini 顶层评论的 `comment.body`。
- `pull_request_review`：先使用 `review.body`，再按 `review.id` 拉取同一条 review 的 inline comments，拼成完整 `REVIEW_BODY`。

提取后的文本必须同时写入环境变量和 `/tmp/review.md`。`/tmp/review.md`
是确定性转换来源；`/tmp/review.json` 是 `pr-auto-fix` 的主输入：

```bash
REVIEW_TEXT="$RAW_REVIEW_BODY"

if [[ "$EVENT_NAME" == "pull_request_review" && -n "${REVIEW_ID}" ]]; then
  INLINE_COMMENTS="$(
    gh api "repos/${GH_REPO}/pulls/${PR_NUMBER}/comments" --paginate --jq "
      .[]
      | select(.pull_request_review_id == ${REVIEW_ID})
      | \"### \" + .path + \":\" + ((.line // .original_line // 0) | tostring) + \"\n\" + .body
    "
  )"

  if [[ -n "$INLINE_COMMENTS" ]]; then
    REVIEW_TEXT="${REVIEW_TEXT}"$'\n\n'"## Inline Review Comments"$'\n'"${INLINE_COMMENTS}"
  fi
fi

printf '%s\n' "$REVIEW_TEXT" > /tmp/review.md
```

完整落地见仓库根目录 `.github/workflows/codex-auto-fix.yml`。对应契约由
`tests/workflow_state.rs` 覆盖：并发必须是 job 级，JSON 转换必须在
`pr-auto-fix --review-json "$REVIEW_JSON_PATH"` 前完成校验，且
`USE_REVIEW_JSON=false` 必须保留 Markdown 回滚路径。

### Auto-Fix 观测字段

`pr-auto-fix` stdout JSON 除了 `fixed`、`pending_count`、`review_clean` 外，
还包含：

- `apply_fail_reason`：最近一次 diff apply 失败分类，可能为
  `malformed_diff`、`context_mismatch`、`drift`、`unknown` 或 `null`。
- `retry_count`：发生过 `patch_apply_retry` 的次数。
- `fallback_used`：是否成功使用 full-file fallback。
- `final_status`：`clean`、`pending` 或 `needs-human`。
- `issue_statuses`：每个 `Medium/Medium+/High/Critical` Gemini issue 的一一对应状态；PR 评论必须展示同源状态表。

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
