# Exec Plan: Corrupt Patch Fallback

## Goal
Make `codex-auto-fix` automatically recover when the model returns malformed
unified diffs for simple review feedback.

## Assumptions
- `git apply` remains the preferred first path because it is precise and
  rollback-friendly.
- A full-file replacement fallback is acceptable only after both initial and
  retry diffs fail.
- The normal security and quality gates still evaluate fallback changes.

## Risks
- Full-file replacement has a larger blast radius than a diff.
- The model may return explanations instead of file content.
- The fallback must not mask genuine ambiguity in reviewer feedback.

## Plan
1. Apply Gemini's two script maintainability suggestions manually.
2. Add a full-file fallback after retry patch application fails.
3. Add an e2e regression test where both diffs are corrupt but full-file
   replacement succeeds.
4. Run shell syntax checks, workflow state tests, and full `cargo test`.

## Acceptance
- The reviewed script refactors are present.
- Corrupt diff retry no longer leaves a simple issue pending.
- Existing auto-fix behavior and workflow state tests stay green.
