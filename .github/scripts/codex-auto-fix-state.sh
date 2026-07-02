#!/usr/bin/env bash
set -euo pipefail

mode="${1:-apply}"

current="${CURRENT_ROUND:-${CURRENT_ROUND_LABEL:-gemini-review-round-1}}"
fixed="${FIXED:-false}"
push_blocked="${PUSH_BLOCKED:-false}"
pending_count="${PENDING_COUNT:-0}"
max_rounds="${MAX_ROUNDS:-2}"

round_label() {
  printf 'gemini-review-round-%s' "$1"
}

round_number() {
  case "$1" in
    gemini-review-round-max) printf '%s' "$max_rounds" ;;
    gemini-review-round-*) printf '%s' "${1#gemini-review-round-}" ;;
    *) printf '1' ;;
  esac
}

bool() {
  local value
  value="$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')"
  case "$value" in
    true|1|yes) printf 'true' ;;
    *) printf 'false' ;;
  esac
}

fixed="$(bool "$fixed")"
push_blocked="$(bool "$push_blocked")"
current_number="$(round_number "$current")"
next_number=$((current_number + 1))
next_round="gemini-review-round-max"
if (( next_number <= max_rounds )); then
  next_round="$(round_label "$next_number")"
fi

action="advance"
request_review="true"
ready_to_merge="false"
human_block="false"
state_label=""

if [[ "$current" == "gemini-review-round-max" ]]; then
  action="max_stop"
  request_review="false"
  ready_to_merge="false"
elif [[ "$push_blocked" == "true" ]]; then
  action="push_blocked"
  next_round="$current"
  request_review="false"
  human_block="true"
  state_label="gemini-review-needs-human"
elif (( pending_count > 0 )) && [[ "$fixed" == "false" ]]; then
  action="needs_human"
  next_round="$current"
  request_review="false"
  human_block="true"
  state_label="gemini-review-needs-human"
elif (( pending_count > 0 )) && [[ "$fixed" == "true" ]]; then
  if (( current_number >= max_rounds )); then
    action="complete_with_pending"
    next_round="gemini-review-round-max"
    request_review="false"
    human_block="true"
    state_label="gemini-review-needs-human"
  else
    action="advance_with_pending"
    request_review="true"
    state_label="gemini-review-pending"
  fi
elif (( current_number >= max_rounds )); then
  action="complete"
  next_round="gemini-review-round-max"
  request_review="false"
  ready_to_merge="true"
  state_label="gemini-review-clean"
fi

print_plan() {
  printf 'action=%s\n' "$action"
  printf 'current_round=%s\n' "$current"
  printf 'next_round=%s\n' "$next_round"
  printf 'request_review=%s\n' "$request_review"
  printf 'ready_to_merge=%s\n' "$ready_to_merge"
  printf 'human_block=%s\n' "$human_block"
  printf 'state_label=%s\n' "$state_label"
}

ensure_label() {
  local name="$1"
  local color="$2"
  local description="$3"
  gh label create "$name" --color "$color" --description "$description" >/dev/null 2>&1 || true
}

gh_retry() {
  local attempt
  for attempt in 1 2 3; do
    if "$@"; then
      return 0
    fi
    sleep $((attempt * 2))
  done
  echo "::warning::GitHub operation failed after retries: $*" >&2
  return 1
}

remove_label() {
  gh_retry gh api \
    --method DELETE \
    "repos/${GH_REPO:?}/issues/${PR_NUMBER:?}/labels/$1" \
    >/dev/null 2>&1 || true
}

add_label() {
  gh_retry gh api \
    --method POST \
    "repos/${GH_REPO:?}/issues/${PR_NUMBER:?}/labels" \
    -f "labels[]=$1" \
    >/dev/null || true
}

post_comment() {
  gh_retry gh api \
    --method POST \
    "repos/${GH_REPO:?}/issues/${PR_NUMBER:?}/comments" \
    -f "body=$1" \
    >/dev/null || true
}

issue_status_note="问题清单见上方 Codex 分析评论中的 \`Medium/Medium+/High/Critical 对应状态\` 表；每个 Gemini 问题都会标记已解决、未解决、外力阻塞、策略阻塞或推送阻塞。"
retry_guidance="具体原因、解决办法、可重试标记和下一步见上方 Codex 分析评论；如属于断网、Codex 额度不足、GitHub 连接失败、runner 中断或 Gemini 未返回等外力因素，恢复后可手动触发第 3 轮或更多轮继续修复。"
blocked_push_guidance="blocked_push：本地可能已经产生修复文件，但发布链路失败。请检查失败阶段：pre-push 验证 / git commit / git push / GitHub API fallback；按上方原始错误摘要修复验证命令、token/branch protection、网络或 GitHub 状态后再重跑。"

apply_plan() {
  ensure_label "gemini-review-round-1" "6f42c1" "Gemini/Codex review loop round 1"
  ensure_label "gemini-review-round-2" "6f42c1" "Gemini/Codex review loop round 2"
  ensure_label "gemini-review-round-max" "5319e7" "Gemini/Codex automated review loop completed"
  ensure_label "gemini-review-pending" "d29922" "Codex has pending Medium/Medium+/High/Critical review items while another round is queued"
  ensure_label "gemini-review-needs-human" "b60205" "Automated review loop requires human decision"
  ensure_label "gemini-review-clean" "0e8a16" "Automated review loop has no pending Medium/Medium+/High/Critical findings"

  labels_to_clear=(
    "gemini-review-round-1"
    "gemini-review-round-2"
    "gemini-review-round-max"
    "gemini-review-pending"
    "gemini-review-needs-human"
    "gemini-review-clean"
  )
  for label in "${labels_to_clear[@]}"; do
    remove_label "$label"
  done

  case "$action" in
    max_stop)
      add_label "gemini-review-round-max"
      post_comment "🤖 **Codex 自动修复已达到默认 ${max_rounds} 轮上限。** ${issue_status_note} ${retry_guidance} 请人工 Review 后决定合并、人工修复或手动触发第 3 轮或更多轮。"
      ;;
    push_blocked)
      add_label "$current"
      add_label "gemini-review-needs-human"
      post_comment "🤖 **Codex 自动修复已阻塞。** ${issue_status_note} ${blocked_push_guidance} ${retry_guidance}"
      ;;
    needs_human)
      add_label "$current"
      add_label "gemini-review-needs-human"
      post_comment "🤖 **Codex 未能清理当前 Gemini Review 的 Medium/Medium+/High/Critical 问题。** ${issue_status_note} ${retry_guidance} 本轮不会误判为可合并，请人工处理或手动触发第 3 轮或更多轮。"
      ;;
    advance|advance_with_pending)
      add_label "$next_round"
      if [[ -n "$state_label" ]]; then
        add_label "$state_label"
      fi
      review_requested_at="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
      post_comment "/gemini review"
      if [[ "${WAIT_FOR_GEMINI_REVIEW:-false}" == "true" ]]; then
        REVIEW_REQUESTED_AT="$review_requested_at" bash .github/scripts/gemini-review-watchdog.sh watch
      fi
      if [[ "$action" == "advance_with_pending" ]]; then
        post_comment "🤖 **Codex 已推送部分修复，并请求下一轮 Gemini Review。** ${issue_status_note} ${retry_guidance} 当前仍有 Medium/Medium+/High/Critical 未自动修复说明，下一轮后仍存在则需要人工决策。"
      else
        post_comment "🤖 **Codex 本轮已完成，已请求下一轮 Gemini Review。** ${issue_status_note}"
      fi
      ;;
    complete)
      add_label "gemini-review-round-max"
      add_label "gemini-review-clean"
      post_comment "🤖 **Codex/Gemini 自动 Review 闭环已完成 ${max_rounds} 轮，当前没有 Medium/Medium+/High/Critical 未处理项。** ${issue_status_note} 请人工做最终 diff Review 后决定是否合并。"
      ;;
    complete_with_pending)
      add_label "gemini-review-round-max"
      add_label "gemini-review-needs-human"
      post_comment "🤖 **Codex/Gemini 自动 Review 已达到默认 ${max_rounds} 轮，但仍有 Medium/Medium+/High/Critical 未自动修复说明。** ${issue_status_note} ${retry_guidance} 请人工处理或继续手动触发更多轮。"
      ;;
  esac
}

case "$mode" in
  plan) print_plan ;;
  apply) apply_plan ;;
  *) echo "usage: $0 [plan|apply]" >&2; exit 2 ;;
esac
