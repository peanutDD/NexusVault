# C-325: Codex Review Model Is The Primary Auto Reviewer

Date: 2026-07-04

## Rule

Automatic PR review must not depend on Gemini consumer code review as the
primary signal after the 2026-07-17 Gemini shutdown date.

## Required Pattern

- Root `.github/workflows/codex-code-review.yml` triggers Codex review.
- The review-model CLI lives in `scripts/codex-review-model-cli`.
- Default review model is `gtp-5.5` unless repository configuration overrides
  `CODEX_REVIEW_MODEL`.
- PR review status is summarized in exactly one reusable status comment marked
  with `<!-- nexusvault-auto-review-status -->`.
- Legacy Gemini kickoff is manual, short, and must not poll for 600 seconds.
- Auto-fix verification runs changed-path targeted checks. Full `cargo test`
  remains a CI or final/pre-merge gate.

## Test Hook

Keep `scripts/codex-review-model-cli/tests/smoke.sh` aligned with root
workflow paths, model defaults, the unified status marker, and targeted checks.
