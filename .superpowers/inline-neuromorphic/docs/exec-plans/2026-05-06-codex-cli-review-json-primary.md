# codex-cli review JSON primary input and auto-fix hardening

Date: 2026-05-06

## Assumptions

- `review-to-json` remains the deterministic Markdown-to-JSON conversion step.
- The auto-fix pipeline should use structured JSON as its primary review input.
- Markdown review text remains supported through `USE_REVIEW_JSON=false` and direct CLI fallback.
- `git apply` remains the preferred patch path; full-file replacement is a bounded last resort.

## Risks

- JSON `StructuredReview` and existing `ReviewData` use different field names.
- The workflow can silently regress to Markdown if the `pr-auto-fix` call and rollback branch are not contract-tested.
- Pre-skill workflows still need Markdown input and should fail clearly without it.
- Retry without real `git apply` stderr can repeat the same patch failure.
- Full-file fallback can be too broad unless it has line-count, prefix, and protected-file gates.

## Plan

1. Add failing coverage for `--review-json` as the primary auto-fix input.
2. Add failing coverage for workflow rollback, stderr-aware retry, bounded fallback, and metrics output.
3. Convert `StructuredReview` into existing `ReviewData`, preserving issue constraints.
4. Let `ReadReviewSkill` reuse pre-parsed review data instead of asking the model to parse Markdown.
5. Pass `--review-json "$REVIEW_JSON_PATH"` from the GitHub workflow by default, while preserving `--gemini-review "$REVIEW_BODY"` when `USE_REVIEW_JSON=false`.
6. Capture `git apply` stderr/classification for retry prompts and output metrics.
7. Block full-file fallback outside safe prefixes or protected paths.
8. Update CLI, integration docs, constraints, and quality score.
9. Verify with codex-cli tests, workflow shell syntax, and full cargo test.
