# C-038: Codex Auto-Fix JSON Input, Retry Context, and Fallback Bounds

`codex-auto-fix` must use validated Review JSON as the primary input when
`USE_REVIEW_JSON=true`, and must preserve the Markdown path for emergency
rollback when `USE_REVIEW_JSON=false`.

When a generated diff fails `git apply`, the retry prompt must include the real
`git apply` stderr, the failed patch, the latest target file content, and an
explicit change budget. Retrying without new context is not allowed.

Full-file fallback is a last resort after initial and retry diffs fail. It must
be blocked for protected files, paths outside the allowed source/script
prefixes, and files above the configured line budget.

The command output must expose enough state for workflow decisions and weekly
review: `apply_fail_reason`, `retry_count`, `fallback_used`, and
`final_status`.

## Why

Markdown review parsing drift, context-mismatched patches, and broad fallback
writes can all turn an automated safety mechanism into noisy or risky work.
Structured input, stderr-aware retry, and bounded fallback keep the loop
predictable while preserving human fallback.

## Enforcement

- `scripts/codex-cli/tests/review_to_json.rs`
- `scripts/codex-cli/tests/workflow_state.rs`
- `scripts/codex-cli/tests/e2e_auto_fix.rs`
- `.github/workflows/codex-auto-fix.yml`
