# C-046: Auto Review Comments Must Show Fixed And Unfixed Issues

Date: 2026-05-07

## Rule

Codex auto-review feedback must list Medium/Medium+ issues by status, not only
by changed file or total pending count.

## Required Pattern

- Always render a one-to-one `Medium/Medium+ 对应状态` table in PR feedback
  when a Gemini Review has been parsed. Each Gemini issue must map to exactly
  one status row.
- Show `已自动修复问题` with severity, file, line, and review description.
- Show `未自动修复问题` with severity, file, line, and the concrete failure
  reason.
- Keep the same issue-level information in machine-readable JSON through
  `issue_statuses`, `fixed_explanations`, and `pending_explanations`.
- If a patch was generated but not pushed because of a fail-closed gate, do not
  mark the issue resolved; mark it as blocked/pending in the status table.
- Never post a vague "has unresolved issues" comment without enough detail for a
  human to see what was fixed, what remains, and why automation stopped.
