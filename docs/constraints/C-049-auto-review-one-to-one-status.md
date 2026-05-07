# C-049: Auto Review Must Map Every Medium Issue To A Status

Date: 2026-05-08

## Rule

Every codex-cli auto-review run that parses Gemini Review input must emit a
one-to-one status for each `Medium`, `Medium+`, `High`, or `Critical` issue.

## Required Pattern

- PR comments must include `📋 Medium/Medium+ 对应状态`.
- Every parsed Gemini issue at Medium or higher must appear exactly once in that
  table with severity, file, line, problem text, status, and explanation.
- Machine-readable output must include the same mapping in `issue_statuses`.
- `0 actionable issues` is only allowed to mean the current parsed review has no
  Medium-or-higher issues; it must not hide previous pending items.
- Security or policy gates that prevent a generated patch from reaching the PR
  must be shown as blocked, not resolved.

## Test Hook

Keep regression coverage in `scripts/codex-cli/tests/e2e_auto_fix.rs` and the
`review_status_block` unit tests so the PR comment format and stdout JSON stay
aligned.
