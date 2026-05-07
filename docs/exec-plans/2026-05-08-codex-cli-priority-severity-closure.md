# 2026-05-08 Codex CLI Priority Severity Closure

## Goal

Ensure every auto-review run treats `medium priority`, `medium+ priority`,
`high priority`, and `critical priority` as actionable review severities.

## Assumptions

- Gemini may express severity as either bare labels or labels with a `priority`
  suffix.
- `Low` and `low priority` remain excluded by default.
- The one-to-one `issue_statuses` output is the source of truth for PR comments.

## Risks

- A priority suffix can bypass the allowed severity filter if normalization is
  too literal.
- Inline badge alt text can include `priority` even when the image URL already
  contains the severity.

## Steps

1. Add failing tests for priority-suffix severity normalization.
2. Add failing tests for `DecisionSkill` selecting all four actionable levels.
3. Add failing parser coverage for inline badge alt text like `high priority`.
4. Normalize severity labels before filtering or parsing badge text.
5. Update workflow/docs wording to name all four levels.
6. Run codex-cli tests, clippy, and diff checks.
