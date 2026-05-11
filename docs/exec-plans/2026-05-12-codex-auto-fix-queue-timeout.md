# Exec Plan: Codex Auto-Fix Queue Timeout Guard

## Goal

Prevent one stale `codex-fix` run from blocking later Codex Auto Fix runs forever in the same PR concurrency group.

## Assumptions

- The same PR must still use one concurrency group because multiple agents pushing to one branch concurrently can corrupt the review loop.
- Newer Gemini review events supersede older same-PR auto-fix runs.
- The self-hosted runner can occasionally leave a long-running `codex-auto-fix pr-auto-fix` or local Codex child process alive.

## Risks

- A timeout that is too short can stop a valid large repair.
- A timeout that is too long leaves the active run blocked and hides stale-run behavior.
- Keeping `cancel-in-progress: false` causes repeated Gemini reviews to build a queue before timeout guards can execute.
- Putting concurrency only at the job level is too late for self-hosted runner assignment and can still show `Waiting: This job is waiting on codex-fix...`.
- Cancelling a stale run manually can leave a local child process alive on the self-hosted runner.

## Implementation

1. Cancel the currently stuck older `codex-fix` runs for PR #29.
2. Add a job timeout to `codex-fix`.
3. Move concurrency to workflow level with `cancel-in-progress: true` so newer Gemini reviews cancel stale same-PR runs before runner assignment.
4. Add a shorter timeout to the `调用 codex-auto-fix pr-auto-fix` step.
5. Set `CODEX_AGENT_TIMEOUT_SECONDS` below the step timeout so the child Codex command exits first.
6. Add a queue guard diagnostic step so future waiting states are explainable from logs.
7. Lock the behavior with `workflow_state` tests.

## Acceptance

- `cd scripts/codex-cli && cargo test --test workflow_state codex_auto_fix_serial_runner_has_timeouts`
- `cd scripts/codex-cli && cargo fmt --all -- --check`
- `cd scripts/codex-cli && cargo test --all`
- `cd scripts/codex-cli && cargo clippy --all-targets --all-features -- -D warnings`
