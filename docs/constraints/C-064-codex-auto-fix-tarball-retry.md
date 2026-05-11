# C-064: Codex Auto-Fix PR tarball download must retry stream failures

## Rule

The self-hosted `codex-auto-fix` checkout bootstrap must retry PR-head tarball downloads and must include an HTTP/1.1 curl fallback.

It must still fail closed if the exact PR head cannot be verified.

## Why

GitHub API tarball streaming can fail transiently before auto-fix starts:

```text
stream error: stream ID 1; CANCEL; received from peer
Cannot verify exact PR head ... refusing to run auto-fix on a stale local seed.
```

Failing closed is correct, but a single transient stream cancellation should not exhaust the only API-tarball path.

## Enforcement

`scripts/codex-cli/tests/workflow_state.rs` asserts that the workflow keeps `actions/checkout@v4` out of the self-hosted bootstrap, retries tarball acquisition, and uses `curl --http1.1 --retry-all-errors` as a fallback.
