# 2026-05-08 Codex CLI One-To-One Review Status

## Goal

Make the PR #24 Medium/Medium+ cleanup behavior the default codex-cli behavior
for every PR auto-review run.

## Assumptions

- `codex-cli` handles one Gemini Review per invocation.
- Workflow labels handle multi-round orchestration.
- PR comments and stdout JSON must share the same issue-level status source.

## Risks

- A clean summary could hide historical pending items if the issue-level mapping
  is not emitted.
- A generated patch blocked by security must not be marked resolved.

## Steps

1. Add failing tests for one-to-one issue statuses in stdout JSON and PR comment
   blocks.
2. Add `issue_statuses` to `PrAutoFixOutput`.
3. Render `Medium/Medium+ 对应状态` in every parsed-review feedback comment.
4. Update workflow copy and docs so future agents know this is required.
5. Run codex-cli targeted and full verification before commit/push.
