# Exec Plan: Auto Review Ledger as PR Audit Archive

Date: 2026-05-11

## Goal

Upgrade `codex-auto-fix` review ledger output from a fix-success-biased note into a complete PR review audit archive.

## Assumptions

- `ReviewData.issues` is the canonical structured list of issues parsed from Gemini Review.
- The per-PR ledger path introduced by C-066 remains the durable archive path.
- Low and Info issues should be tracked for auditability, but automatic fix selection remains governed by the existing severity allow-list.
- The ledger should be written when review issues exist, even if no code file was changed.

## Risks

- More verbose ledgers may increase PR noise if every round produces an entry.
- Recording suggestions and constraints must preserve markdown table parseability.
- Changing `ReviewIssueStatus` may affect JSON consumers of `codex-auto-fix`; new fields should be additive.
- Adding ledger files when no code changed must not make JSON `fixed` claim that source issues were repaired.

## Steps

1. Add red tests proving ledger writes all severities and writes even when no fix was produced.
2. Extend issue status records with suggestion, constraints, selection state, failure reason, fix method, and related files.
3. Upgrade resolved explanations from generic `已自动修复` to a concise repair summary.
4. Update ledger markdown table to include original problem, suggestion, constraints, auto-fix scope, fix method, related files, and final answer.
5. Update docs and constraints so future changes cannot regress to partial ledgers.
6. Verify with targeted tests, `cargo fmt`, full `cargo test`, and `cargo clippy`.

## Verification

- `cd scripts/codex-cli && cargo test --test e2e_auto_fix auto_fix_local_records_review_issue_solution_ledger_when_docs_enabled`
- `cd scripts/codex-cli && cargo test --test e2e_auto_fix auto_fix_local_writes_full_review_ledger_even_when_no_fix_applies`
- `cd scripts/codex-cli && cargo fmt --all -- --check`
- `cd scripts/codex-cli && cargo test --all`
- `cd scripts/codex-cli && cargo clippy --all-targets --all-features -- -D warnings`

