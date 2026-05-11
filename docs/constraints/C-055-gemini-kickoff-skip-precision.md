# C-055: Gemini Kickoff Skip Precision

Date: 2026-05-09

## Constraint

`gemini-review-kickoff` may skip only the exact bot-owned auto-fix commit
subject prefix:

```text
🤖 codex auto-fix:
```

It must not skip arbitrary human commits that merely mention `codex auto-fix`
in their subject or body.

## Why

The previous wildcard check matched a manual commit named
`fix: relax codex auto-fix blockers`, so the 960c60d review-verification push
did not request a new Gemini review. That made the real review loop appear
green while the Gemini step had actually been skipped.

## Enforcement

- `scripts/codex-cli/tests/workflow_state.rs` must assert that
  `.github/workflows/gemini-review-kickoff.yml` does not use the broad
  `*codex auto-fix*` pattern.
- The workflow must match only the bot commit subject prefix.
