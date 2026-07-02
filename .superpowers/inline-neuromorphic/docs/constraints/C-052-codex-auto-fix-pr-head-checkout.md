# C-052 Codex Auto Fix PR Head Checkout

## Constraint

`Codex Auto Fix` must not rely on the default `actions/checkout` ref for `pull_request_review` events.

The workflow must:

- checkout `${{ github.event.pull_request.head.sha || github.sha }}` before any PR-specific work
- use `fetch-depth: 0` so later `gh pr checkout` and pushes have enough history
- retry `gh pr checkout "${PR_NUMBER}" --repo "${GITHUB_REPOSITORY}"` for transient GitHub/self-hosted runner network failures

## Rationale

On self-hosted runners, the default checkout for review events can fetch a volatile PR merge ref. A transient GitHub 443 failure while fetching that merge ref fails the job before `pr-auto-fix` even starts, making healthy PR code look red.

## Enforcement

- `scripts/codex-cli/tests/workflow_state.rs` checks that `codex-auto-fix.yml` uses PR head checkout, full fetch history, and retrying explicit PR branch checkout.
