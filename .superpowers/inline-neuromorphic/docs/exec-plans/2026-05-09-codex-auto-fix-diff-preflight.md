# Exec Plan: Codex Auto-Fix Diff Preflight

Date: 2026-05-09

## Goal

Reduce repeated `git apply` malformed diff failures in `codex-auto-fix` and make security-blocked runs easier to diagnose.

## Assumptions

- The repeated `corrupt patch` / `patch fragment without header` logs come from invalid LLM unified diff output, not from a broken target file.
- Existing retry and full-file fallback behavior should remain intact.
- The auto-fix path is scoped to one review issue file at a time.

## Risks

- Diff validation that is too broad could accept cross-file patches.
- Diff validation that is too strict could reject legitimate single-file edits.
- Security failures could remain hidden if they only set `push_blocked` without a pending explanation.

## Steps

1. Add failing tests for patch fragments and malformed hunk headers.
2. Add repo-layer unified diff preflight before `git apply`.
3. Tighten initial and retry patch-generation prompts to require full diff headers.
4. Surface security audit findings as pending explanations.
5. Run `cargo fmt` and full `scripts/codex-cli` tests.

## Verification

- `cargo test --manifest-path scripts/codex-cli/Cargo.toml apply_patch_preflight -- --nocapture`
- `cargo test --manifest-path scripts/codex-cli/Cargo.toml auto_fix_local_blocks_push_when_security_audit_fails -- --nocapture`
- `cargo fmt --manifest-path scripts/codex-cli/Cargo.toml`
- `cargo test --manifest-path scripts/codex-cli/Cargo.toml`
