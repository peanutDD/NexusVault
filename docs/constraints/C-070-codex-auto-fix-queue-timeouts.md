# C-070: Codex Auto-Fix review runs must not stale-block the queue

## Rule

`Codex Auto Fix (本地 Runner)` must use workflow-level concurrency so newer Gemini review events cancel older same-PR `codex-fix` runs before they wait for the self-hosted runner.

Required guards:

- workflow-level concurrency with `cancel-in-progress: true`
- concurrency group uses workflow-initialization-safe fields (`github.ref` and `github.actor`); do not use deep event payload fields in workflow-level concurrency
- job-level `timeout-minutes`
- `调用 codex-auto-fix pr-auto-fix` step-level `timeout-minutes`
- `CODEX_AGENT_TIMEOUT_SECONDS` lower than the step timeout
- `CODEX_AUTO_FIX_BUDGET_SECONDS` lower than the step timeout so `codex-cli` can stop starting new model calls and return JSON before GitHub Actions kills the shell
- model-based post-fix checks such as `SecurityCheck` and `QualityScore` are soft gates: timeout or parse failure must be recorded as pending/unavailable output, not process failure
- queue guard diagnostics that print the PR concurrency group and timeout budget

## Why

Gemini can submit multiple `pull_request_review` events for the same PR head. If `cancel-in-progress` is false, each event becomes a queued `codex-fix` job and later runs show:

`Waiting: This job is waiting on codex-fix ... to complete before running.`

Only the latest Gemini review for a PR ref should drive auto-fix; older runs are stale. Job-level concurrency is too late for self-hosted runner assignment and can still leave newer jobs waiting. Timeouts remain as a second guard for the run that is actually executing.

The workflow must not rely only on an outer Actions timeout. In PR #32 the `调用 codex-auto-fix pr-auto-fix` step was killed after 30 minutes while `QualityScore` was running. The CLI had already applied useful patches, but the shell timeout prevented JSON output, commit, push, and state advancement. The runtime budget must therefore be visible to `codex-cli`, and optional LLM audits must degrade gracefully.

## Enforcement

`scripts/codex-cli/tests/workflow_state.rs::codex_auto_fix_serial_runner_has_timeouts` locks the timeout and diagnostics contract.
`scripts/codex-cli/tests/workflow_state.rs::codex_auto_fix_concurrency_is_job_scoped` locks workflow-level stale-run cancellation.
`scripts/codex-cli/tests/workflow_state.rs::codex_auto_fix_has_coherent_runtime_budget` locks the job, step, model-call, and CLI budget relationship.
`scripts/codex-cli/tests/e2e_auto_fix.rs::auto_fix_local_keeps_partial_fix_when_security_check_times_out` and `auto_fix_local_keeps_partial_fix_when_quality_score_times_out` lock graceful degradation for slow optional checks.
