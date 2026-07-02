# Exec-Plan: Codex Auto-Fix Resilient Checkout

- Date: 2026-05-11
- Scope: `.github/workflows/codex-auto-fix.yml`, `scripts/codex-cli/`
- Trigger: self-hosted runner fails before auto-fix starts because `actions/checkout@v4` cannot `git fetch` from GitHub HTTPS (`Empty reply from server`, `Failed to connect`).

## Goal

Make the Codex Auto Fix workflow tolerate GitHub Git transport flakiness during checkout by bootstrapping from a local repository seed and validating the exact PR head through the GitHub API tarball path. When the workflow uses that detached local bootstrap, force codex-cli publishing through the existing GitHub Git Data API path instead of normal `git push`.

## Non-Goals

- Do not change the CI workflow on GitHub-hosted runners.
- Do not change review parsing, fix selection, or security scoring logic.
- Do not hide a full GitHub API outage. If both the local seed and API cannot provide the exact PR head, fail closed with a clear error.

## Assumptions

- The self-hosted runner has a local seed repository at `/Users/tyone/github/upload-download-util`, overrideable with `CODEX_LOCAL_REPO_SEED`.
- `GH_TOKEN` can read the PR tarball and update the PR branch through GitHub API.
- API calls to `api.github.com` are more reliable than Git smart HTTP pack transfer on this runner.

## Risks

- A stale seed repository could produce wrong input. Mitigation: require either exact local commit match or successful API tarball overlay before running auto-fix.
- API-tarball bootstrap creates a local synthetic baseline commit. Mitigation: set `CODEX_PUBLISH_VIA_GH_API=true` so codex-cli publishes only the auto-fix diff against the real remote branch head.
- Workflow shell changes are hard to unit-test end to end. Mitigation: add workflow-state tests asserting the required resilience markers are present.

## TDD Steps

1. Add failing workflow tests requiring no `actions/checkout@v4`, local seed usage, PR head SHA discovery, API tarball overlay, exact-head guard, and `CODEX_PUBLISH_VIA_GH_API=true`.
2. Add a small repo test for truthy parsing of the API-only publish switch.
3. Implement the workflow bootstrap and codex-cli API-only publish switch.
4. Add a permanent constraint documenting that self-hosted auto-fix must not depend on Git HTTPS checkout as its only path.
5. Run `cargo fmt --all -- --check`, `cargo test --all`, and `cargo clippy --all-targets --all-features -- -D warnings` in `scripts/codex-cli`.

## Acceptance

- The Codex Auto Fix workflow can start from local seed plus GitHub API tarball without `actions/checkout`.
- If exact PR head cannot be verified, the workflow exits before running auto-fix.
- codex-cli can be forced to publish with GitHub API via `CODEX_PUBLISH_VIA_GH_API=true`.
- All codex-cli tests, fmt, and clippy pass.
