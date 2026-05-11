# C-070: Codex Auto-Fix review runs must not stale-block the queue

## Rule

`Codex Auto Fix (本地 Runner)` must use workflow-level concurrency so newer Gemini review events cancel older same-PR `codex-fix` runs before they wait for the self-hosted runner.

Required guards:

- workflow-level concurrency with `cancel-in-progress: true`
- concurrency group uses workflow-initialization-safe fields (`github.ref` and `github.actor`); do not use deep event payload fields in workflow-level concurrency
- job-level `timeout-minutes`
- `调用 codex-auto-fix pr-auto-fix` step-level `timeout-minutes`
- `CODEX_AGENT_TIMEOUT_SECONDS` lower than the step timeout
- queue guard diagnostics that print the PR concurrency group and timeout budget

## Why

Gemini can submit multiple `pull_request_review` events for the same PR head. If `cancel-in-progress` is false, each event becomes a queued `codex-fix` job and later runs show:

`Waiting: This job is waiting on codex-fix ... to complete before running.`

Only the latest Gemini review for a PR ref should drive auto-fix; older runs are stale. Job-level concurrency is too late for self-hosted runner assignment and can still leave newer jobs waiting. Timeouts remain as a second guard for the run that is actually executing.

## Enforcement

`scripts/codex-cli/tests/workflow_state.rs::codex_auto_fix_serial_runner_has_timeouts` locks the timeout and diagnostics contract.
`scripts/codex-cli/tests/workflow_state.rs::codex_auto_fix_concurrency_is_job_scoped` locks job-scoped concurrency and stale-run cancellation.
