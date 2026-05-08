# 2026-05-08 Auto Review Status List Comments

## Goal

Make every automatic review state comment point to the generated issue status
list, and make Gemini quota/timeout comments explain why no new list exists.

## Assumptions

- `codex-auto-fix` feedback comments already render the
  `Medium/Medium+/High/Critical 对应状态` table when review input exists.
- Workflow state comments are separate from codex-cli feedback comments.
- Gemini quota/timeout means there is no new review input to parse.

## Risks

- A final clean/pending summary can look like the only source of truth if it
  does not point to the issue table.
- A timeout comment can look like automation skipped issues unless it explains
  that Gemini produced no new review.

## Steps

1. Add failing tests for workflow state comments referencing the automatic issue
   list.
2. Add failing tests for watchdog timeout comments explaining no new list.
3. Update state-machine comments to point to the issue status table.
4. Update watchdog timeout copy for quota/no-review cases.
5. Run codex-cli tests, clippy, and diff checks.
