# Exec Plan: Codex Auto-Fix Malformed Direct Fallback

Date: 2026-05-09

## Goal

Stop repeated malformed diff retry loops and make auto-fix pushes resilient to
transient GitHub network failures.

## Assumptions

- `malformed_diff` means the model produced an invalid patch shape, not a normal
  context mismatch.
- Full-file fallback is now allowed for normal source files and is the better
  recovery path for malformed diffs.
- `Empty reply from server` during `git push` is transient and safe to retry.

## Risks

- Direct fallback writes more content than a diff, so protected-file and
  allowed-prefix gates must remain.
- Push retry must not hide non-transient failures such as rejected refs.

## Steps

1. Add red e2e coverage requiring malformed diffs to skip retry-patch generation.
2. Route `malformed_diff` directly to full-file fallback.
3. Add hunk body count validation to diff preflight.
4. Add transient git push classification and retry push up to three attempts.
5. Update permanent constraints and quality score.
6. Run focused tests, full codex-cli tests, fmt, and clippy.

## Verification

- `cargo test --manifest-path scripts/codex-cli/Cargo.toml apply_patch_preflight -- --nocapture`
- `cargo test --manifest-path scripts/codex-cli/Cargo.toml malformed_diff_goes_directly_to_full_file_fallback_without_retry_patch -- --nocapture`
- `cargo test --manifest-path scripts/codex-cli/Cargo.toml transient_git_push_errors_are_retryable -- --nocapture`
- `cargo test --manifest-path scripts/codex-cli/Cargo.toml`
- `cargo clippy --manifest-path scripts/codex-cli/Cargo.toml --all-targets -- -D warnings`
