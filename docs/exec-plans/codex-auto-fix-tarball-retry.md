# Exec-Plan: Codex Auto-Fix PR Tarball Retry

- Date: 2026-05-11
- Scope: `.github/workflows/codex-auto-fix.yml`, codex-cli workflow tests
- Trigger: resilient checkout fails when `gh api repos/.../tarball/<sha>` returns `stream error: stream ID 1; CANCEL; received from peer`.

## Goal

Keep the fail-closed exact PR head guard, but make the tarball acquisition resilient to transient GitHub API/codeload stream failures.

## Non-Goals

- Do not run auto-fix on an unverified local seed.
- Do not reintroduce `actions/checkout@v4` as the self-hosted runner bootstrap.
- Do not force-push or rewrite PR history.

## Assumptions

- `gh api` can still fail transiently even when GitHub is reachable.
- `curl --http1.1 --retry --retry-all-errors` is a useful fallback for HTTP/2 stream cancellation.
- If both local exact commit and tarball download fail, refusing to run is safer than patching stale code.

## Steps

1. Add workflow contract assertions for tarball retry and HTTP/1.1 curl fallback.
2. Implement a `download_pr_head_archive` shell helper with multiple attempts.
3. Use the helper before extracting the archive.
4. Run codex-cli workflow tests plus fmt/test/clippy.

## Acceptance

- Workflow contains no `actions/checkout@v4`.
- Workflow tries multiple tarball download attempts.
- Workflow falls back from `gh api` streaming to `curl --http1.1` with retry.
- Existing exact-head fail-closed behavior remains.
