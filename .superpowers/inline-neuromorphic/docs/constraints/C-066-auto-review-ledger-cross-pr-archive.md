# C-066: Auto review ledger must archive records per PR

## Rule

`codex-auto-fix` must not store review outcomes only in a single current-PR ledger file.

Every ledger write must update both:

- `docs/auto-review-ledger.md` as the global append-only ledger.
- `docs/auto-review-ledgers/pr-<number>.md` for PR runs, or `docs/auto-review-ledgers/local.md` for local runs.

## Why

A single ledger file makes it easy to confuse a current PR's partial review history with the repository's complete review archive. Per-PR files keep every PR's review records discoverable without losing the global timeline.

## Enforcement

`scripts/codex-cli/tests/e2e_auto_fix.rs::auto_fix_local_records_review_issue_solution_ledger_when_docs_enabled` asserts the local scoped ledger is written. `scripts/codex-cli/tests/review_ledger.rs::scoped_path_is_stable` locks the stable PR path format.
