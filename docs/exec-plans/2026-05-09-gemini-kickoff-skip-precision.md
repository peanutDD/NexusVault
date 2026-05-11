# Exec Plan: Gemini Kickoff Skip Precision

Date: 2026-05-09

## Goal

Make the post-960c60d Gemini review verification real by fixing the kickoff
skip predicate that misclassified a human commit as an auto-fix commit.

## Assumptions

- `fix: relax codex auto-fix blockers` is a human-authored strategy commit and
  should request Gemini review.
- True bot auto-fix commits use the `🤖 codex auto-fix:` subject prefix.

## Risks

- A too-broad skip predicate hides review-loop failures.
- A too-narrow skip predicate could cause duplicate Gemini requests after real
  bot auto-fix commits.

## Steps

1. Add a workflow contract test for the Gemini kickoff skip predicate.
2. Narrow the workflow condition to the exact bot commit subject prefix.
3. Record the permanent constraint.
4. Run codex-cli workflow tests.
5. Push a new commit whose subject does not contain the skipped phrase, forcing
   a real Gemini kickoff run.

## Verification

- `cargo test --manifest-path scripts/codex-cli/Cargo.toml gemini_kickoff_only_skips_actual_auto_fix_commit_subjects -- --nocapture`
- `cargo test --manifest-path scripts/codex-cli/Cargo.toml`
- `cargo clippy --manifest-path scripts/codex-cli/Cargo.toml --all-targets -- -D warnings`
- GitHub Actions `Gemini Review Kickoff` must run after the pushed commit and
  must not log the old skip message.
