# Exec-Plan: Auto Review Ledger Cross-PR Archive

- Date: 2026-05-11
- Scope: `scripts/codex-cli` ledger writer and docs
- Problem: `docs/auto-review-ledger.md` behaves like a local/current-PR ledger, so review history is fragmented and does not clearly preserve every PR's review records.

## Goal

Keep the existing global ledger for compatibility, and also write each PR's review records to a stable per-PR archive path:

- `docs/auto-review-ledger.md` as the global append-only ledger.
- `docs/auto-review-ledgers/pr-<number>.md` for PR runs.
- `docs/auto-review-ledgers/local.md` for local runs where no PR number exists.

## Non-Goals

- Do not rewrite old PR history from GitHub comments in this change.
- Do not delete or rename the existing `docs/auto-review-ledger.md`.
- Do not touch unrelated in-progress `doctor` changes.

## Risk

Writing two ledger files increases commit noise slightly, but it makes auditability explicit and avoids losing per-PR context in a large global file.

## TDD Steps

1. Extend the existing ledger E2E test to require both global and per-PR/local ledger files.
2. Update the repo ledger writer to append the same entry to both paths and include both paths in `fixed_files`.
3. Update documentation and constraint text.
4. Run targeted test plus codex-cli fmt/test/clippy.
