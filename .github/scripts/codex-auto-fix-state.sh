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

remove_label() {
  gh pr edit "${PR_NUMBER:?}" --remove-label "$1" >/dev/null 2>&1 || true
}

add_label() {
  gh pr edit "${PR_NUMBER:?}" --add-label "$1"
}

apply_plan() {
  ensure_label "gemini-review-round-1" "6f42c1" "Gemini/Codex review loop round 1"
  ensure_label "gemini-review-round-2" "6f42c1" "Gemini/Codex review loop round 2"
  ensure_label "gemini-review-round-max" "5319e7" "Gemini/Codex automated review loop completed"
  ensure_label "gemini-review-pending" "d29922" "Codex has pending medium+ review items while another round is queued"
  ensure_label "gemini-review-needs-human" "b60205" "Automated review loop requires human decision"
  ensure_label "gemini-review-clean" "0e8a16" "Automated review loop has no pending medium+ findings"

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
      gh pr comment "${PR_NUMBER:?}" --body "🤖 **Codex 自动修复已达到 ${max_rounds} 轮上限。** 请人工 Review 后决定合并或重跑。"
      ;;
    push_blocked)
      add_label "$current"
      add_label "gemini-review-needs-human"
      gh pr comment "${PR_NUMBER:?}" --body "🤖 **Codex 自动修复已阻塞。** 安全审计 fail-closed，未推送自动修复。请人工处理后决定是否重跑 Gemini Review。"
      ;;
    needs_human)
      add_label "$current"
      add_label "gemini-review-needs-human"
      gh pr comment "${PR_NUMBER:?}" --body "🤖 **Codex 未能清理当前 Gemini Review 的 Medium+ 问题。** 已在上方评论列出未自动修复原因；本轮不会误判为可合并，请人工处理或重跑。"
      ;;
    advance|advance_with_pending)
      add_label "$next_round"
      if [[ -n "$state_label" ]]; then
        add_label "$state_label"
      fi
      review_requested_at="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
      gh pr comment "${PR_NUMBER:?}" --body "/gemini review"
      if [[ "${WAIT_FOR_GEMINI_REVIEW:-false}" == "true" ]]; then
        REVIEW_REQUESTED_AT="$review_requested_at" bash .github/scripts/gemini-review-watchdog.sh watch
      fi
      if [[ "$action" == "advance_with_pending" ]]; then
        gh pr comment "${PR_NUMBER:?}" --body "🤖 **Codex 已推送部分修复，并请求下一轮 Gemini Review。** 当前仍有 Medium+ 未自动修复说明，下一轮后仍存在则需要人工决策。"
      else
        gh pr comment "${PR_NUMBER:?}" --body "🤖 **Codex 本轮已完成，已请求下一轮 Gemini Review。**"
      fi
      ;;
    complete)
      add_label "gemini-review-round-max"
      add_label "gemini-review-clean"
      gh pr comment "${PR_NUMBER:?}" --body "🤖 **Codex/Gemini 自动 Review 闭环已完成 ${max_rounds} 轮，当前没有 Medium+ 未处理项。** 请人工做最终 diff Review 后决定是否合并。"
      ;;
    complete_with_pending)
      add_label "gemini-review-round-max"
      add_label "gemini-review-needs-human"
      gh pr comment "${PR_NUMBER:?}" --body "🤖 **Codex/Gemini 自动 Review 已达到 ${max_rounds} 轮，但仍有 Medium+ 未自动修复说明。** 请人工处理或明确接受这些 pending 后再合并。"
      ;;
  esac
}

case "$mode" in
  plan) print_plan ;;
  apply) apply_plan ;;
  *) echo "usage: $0 [plan|apply]" >&2; exit 2 ;;
esac
