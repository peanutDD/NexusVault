# 2026-07-04 Codex Review Model CLI

## Goal

Move actionable automation to root GitHub workflows, make CI/Codex review
triggerable, retire Gemini as the primary reviewer, and fix PR #5 High review
findings before merge.

## Scope

- Root `.github/workflows` for CI, Codex review, Codex auto-fix, and manual
  legacy Gemini kickoff.
- New independent `scripts/codex-review-model-cli` using default model
  `gtp-5.5`.
- One PR status comment via `<!-- nexusvault-auto-review-status -->`.
- Backend fulltext search regression fixes for scoped count, root parsing,
  scoped underfill fallback, and hit materialization batching.

## Out Of Scope

- Do not replace `scripts/codex-cli`.
- Do not merge PR #5.
- Do not modify frontend UI, layout, color, or scaling.

## Risks

- Gemini consumer review stops code review activity on 2026-07-17.
- `CODEX_REVIEW_COMMAND` and `CODEX_AGENT_COMMAND` must be configured in the
  repository or self-hosted runner environment.
- Existing uncommitted local work must not be staged with this PR update.

## Verification

- `cargo test --test fulltext_search_tests`
- `bash scripts/codex-review-model-cli/tests/smoke.sh`
- `cargo fmt --all -- --check`
- `cargo clippy --all-targets --all-features -- -D warnings`
- `git diff --check`
- After push: `gh run list`, `gh pr checks 5`, and one PR status comment.

## Rollback

Revert the follow-up commit on PR #5. The new CLI is isolated and does not
overwrite `scripts/codex-cli`.
