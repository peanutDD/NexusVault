# C-034: Codex Review Concurrency Must Be Job Scoped

Status: active

## Rule

`Codex Auto Fix` must not use workflow-level `concurrency` for mixed `issue_comment` and `pull_request_review` triggers.

Put concurrency on the actionable `codex-fix` job instead, after the job `if` filter.

## Why

GitHub evaluates workflow-level concurrency before job-level `if` filters. A non-actionable PR comment can still occupy the pending concurrency slot and cancel the real Gemini `pull_request_review` event that should run Codex fixes.

This breaks the two-round Gemini/Codex loop: Gemini review exists, but the corresponding Codex run is cancelled before a job is created.

## Enforcement

`scripts/codex-cli/tests/workflow_state.rs` checks that `.github/workflows/codex-auto-fix.yml` has no workflow-level concurrency and keeps `cancel-in-progress: false` on the `codex-fix` job.
