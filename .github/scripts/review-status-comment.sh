#!/usr/bin/env bash
set -euo pipefail

marker="<!-- nexusvault-auto-review-status -->"
body_file="${BODY_FILE:-}"

if [[ -z "${GH_REPO:-}" || -z "${PR_NUMBER:-}" ]]; then
  echo "GH_REPO and PR_NUMBER are required" >&2
  exit 2
fi

if [[ -n "$body_file" ]]; then
  body="$(cat "$body_file")"
else
  status="${STATUS:-pending}"
  title="${TITLE:-NexusVault Auto Review Status}"
  summary="${SUMMARY:-Automated review status updated.}"
  details="${DETAILS:-No additional details.}"
  body="${marker}
## ${title}

- Status: ${status}
- Updated: $(date -u +"%Y-%m-%dT%H:%M:%SZ")

${summary}

${details}"
fi

if [[ "$body" != *"$marker"* ]]; then
  body="${marker}
${body}"
fi

comment_id="$(
  gh api "repos/${GH_REPO}/issues/${PR_NUMBER}/comments" --paginate --jq \
    ".[] | select(.body | contains(\"${marker}\")) | .id" | tail -n 1
)"

if [[ -n "$comment_id" ]]; then
  gh api --method PATCH "repos/${GH_REPO}/issues/comments/${comment_id}" -f "body=${body}" >/dev/null
else
  gh api --method POST "repos/${GH_REPO}/issues/${PR_NUMBER}/comments" -f "body=${body}" >/dev/null
fi
