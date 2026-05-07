# C-046: Auto Review Comments Must Show Fixed And Unfixed Issues

Date: 2026-05-07

## Rule

Codex auto-review feedback must list Medium/Medium+ issues by status, not only
by changed file or total pending count.

## Required Pattern

- Show `已自动修复问题` with severity, file, line, and review description.
- Show `未自动修复问题` with severity, file, line, and the concrete failure
  reason.
- Keep the same issue-level information in machine-readable JSON through
  `fixed_explanations` and `pending_explanations`.
- Never post a vague "has unresolved issues" comment without enough detail for a
  human to see what was fixed, what remains, and why automation stopped.
