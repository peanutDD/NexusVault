#!/usr/bin/env bash
set -euo pipefail

mode="${1:-watch}"
review_found="${GEMINI_REVIEW_FOUND:-}"
timeout_seconds="${GEMINI_REVIEW_TIMEOUT_SECONDS:-600}"
poll_interval_seconds="${GEMINI_REVIEW_POLL_INTERVAL_SECONDS:-15}"
requested_at="${REVIEW_REQUESTED_AT:-}"
review_required="${GEMINI_REVIEW_REQUIRED:-true}"

bool() {
  local value
  value="$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')"
  case "$value" in
    true|1|yes) printf 'true' ;;
    *) printf 'false' ;;
  esac
}

plan_action() {
  if [[ "$(bool "${review_found:-false}")" == "true" ]]; then
    printf 'found'
  else
    printf 'timeout'
  fi
}

print_plan() {
  local action
  action="$(plan_action)"
  printf 'action=%s\n' "$action"
  printf 'needs_human=%s\n' "$([[ "$action" == "timeout" && "$(bool "$review_required")" == "true" ]] && printf true || printf false)"
  printf 'timeout_seconds=%s\n' "$timeout_seconds"
}

ensure_label() {
  gh label create "gemini-review-needs-human" \
    --color "b60205" \
    --description "Automated review loop requires human decision" >/dev/null 2>&1 || true
}

review_count() {
  gh api "repos/${GH_REPO:?}/pulls/${PR_NUMBER:?}/reviews" --paginate --jq "
    [
      .[]
      | select((.user.login | startswith(\"gemini-code-assist\")) and .commit_id == \"${PR_SHA:?}\" and .submitted_at >= \"${requested_at:?}\")
    ]
    | length
  "
}

review_comment_count() {
  gh api "repos/${GH_REPO:?}/issues/${PR_NUMBER:?}/comments" --paginate --jq "
    [
      .[]
      | select((.user.login | startswith(\"gemini-code-assist\")) and .created_at >= \"${requested_at:?}\")
      | select((.body | contains(\"Gemini Code Assist Review\")) or (.body | contains(\"Code Review\")))
    ]
    | length
  "
}

found_remote_review() {
  local reviews comments
  reviews="$(review_count)"
  comments="$(review_comment_count)"
  [[ "${reviews:-0}" -gt 0 || "${comments:-0}" -gt 0 ]]
}

watch() {
  if [[ -z "$requested_at" ]]; then
    requested_at="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  fi

  local deadline now
  deadline=$(( $(date +%s) + timeout_seconds ))

  while true; do
    if found_remote_review; then
      echo "Gemini review found for ${PR_SHA} after ${requested_at}."
      exit 0
    fi

    now="$(date +%s)"
    if (( now >= deadline )); then
      break
    fi

    sleep "$poll_interval_seconds"
  done

  if [[ "$(bool "$review_required")" == "true" ]]; then
    echo "Gemini review timeout is blocking by default for ${PR_SHA}."
    ensure_label
    gh pr edit "${PR_NUMBER:?}" --add-label "gemini-review-needs-human"
    gh pr comment "${PR_NUMBER:?}" --body "🤖 **Gemini Review 请求超时（blocked_external）。** 已发送 \`/gemini review\`，但在 ${timeout_seconds}s 内没有检测到 Gemini 对最新 commit \`${PR_SHA}\` 的 review。由于没有新的 Gemini Review 输入，无法生成新的 Medium/Medium+/High/Critical 问题清单；请以上一次 Codex 分析评论中的对应状态表为准。具体原因：Gemini 未返回 review。解决办法：确认 Gemini 配额、权限和 GitHub 连接后，删除 \`gemini-review-needs-human\`，必要时添加 \`gemini-review-round-3\` 或更高轮次标签，再评论 \`/gemini review\` 重跑。可重试：true。"
    exit 1
  fi

  echo "Gemini review timeout is explicitly non-blocking for ${PR_SHA}."
  gh pr comment "${PR_NUMBER:?}" --body "🤖 **Gemini Review 请求超时（显式非阻塞）。** 已发送 \`/gemini review\`，但在 ${timeout_seconds}s 内没有检测到 Gemini 对最新 commit \`${PR_SHA}\` 的 review。由于没有新的 Gemini Review 输入，无法生成新的 Medium/Medium+/High/Critical 问题清单；本次 kickoff 按显式配置不阻塞，后续 Gemini review 若到达会由 codex-fix 处理并清理自动 review 状态。" || true
  exit 0
}

case "$mode" in
  plan) print_plan ;;
  watch) watch ;;
  *) echo "usage: $0 [plan|watch]" >&2; exit 2 ;;
esac
