# Codex Review Model CLI

This directory contains the new automatic code-review path that replaces the
Gemini consumer review dependency.

## Why

Gemini consumer code review activity is scheduled to stop on 2026-07-17. The
root workflow `.github/workflows/codex-code-review.yml` now calls this CLI as
the primary reviewer, while `.github/workflows/gemini-review-kickoff.yml`
remains a short manual legacy fallback.

## Model

The default review model is `gtp-5.5`.

Override it only when the repository configuration changes:

```bash
CODEX_REVIEW_MODEL=gtp-5.5 \
CODEX_REVIEW_COMMAND='codex review --model "$CODEX_REVIEW_MODEL"' \
scripts/codex-review-model-cli/bin/codex-review-model review-pr --pr-number 5
```

## Workflow Shape

- `review-pr` gathers changed paths and PR diff, builds a review prompt, invokes
  `CODEX_REVIEW_COMMAND`, then updates the single PR status comment.
- `targeted-checks --changed-only` runs checks based on changed paths. Backend
  changes run fmt and clippy; frontend changes run install, lint, and typecheck.
  Full `cargo test` is left to CI or final/pre-merge validation.
- `plan` prints machine-readable defaults for workflow tests and diagnostics.

The command intentionally does not mutate `scripts/codex-cli`; that older
auto-fix executor can still consume the review output.
