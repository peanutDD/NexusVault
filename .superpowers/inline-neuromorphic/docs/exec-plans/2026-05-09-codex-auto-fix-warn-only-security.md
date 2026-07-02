# Exec Plan: Codex Auto-Fix Warn-Only Security And Large Fallback

Date: 2026-05-09

## Goal

Allow High priority review fixes to proceed when the only blockers are the old
300-line full-file fallback cap or prompt-based SecurityCheck fail-closed.

## Assumptions

- Prompt-based SecurityCheck is useful evidence but too noisy to be a hard push
  blocker.
- Source files above 300 lines are normal in the current codebase.
- Protected-file and allow-list gates are still required for full-file fallback.

## Risks

- Removing the line cap makes fallback more powerful, so protected path checks
  must remain.
- Warn-only security could hide real risks if findings are not surfaced in
  output and PR comments.

## Steps

1. Add red e2e coverage for security failures that still commit and push.
2. Add red e2e coverage for large-file full-file fallback.
3. Remove SecurityCheck push blocking while preserving warnings.
4. Remove the global full-file fallback line-count cap.
5. Update constraints and quality score.
6. Verify with focused tests, full codex-cli tests, fmt, and clippy.

## Verification

- `cargo test --manifest-path scripts/codex-cli/Cargo.toml auto_fix_local_warns_but_pushes_when_security_audit_fails -- --nocapture`
- `cargo test --manifest-path scripts/codex-cli/Cargo.toml full_file_fallback_allows_large_files -- --nocapture`
- `cargo fmt --manifest-path scripts/codex-cli/Cargo.toml`
- `cargo test --manifest-path scripts/codex-cli/Cargo.toml`
- `cargo clippy --manifest-path scripts/codex-cli/Cargo.toml --all-targets -- -D warnings`
