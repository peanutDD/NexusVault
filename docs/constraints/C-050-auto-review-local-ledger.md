# C-050 Auto Review Local Ledger

## Constraint

When `codex-auto-fix` resolves any `Medium`, `Medium+`, `High`, or `Critical` Gemini Review issue, the local project must keep a durable per-issue record in `docs/auto-review-ledger.md`.

The record must include:

- Gemini issue severity
- file and line
- Gemini issue text
- resolved / pending / blocked status
- Codex solution answer or pending reason
- changed files included in the attempted fix

## Rationale

PR comments and stdout JSON are not enough for later local diagnosis. A future Agent must be able to answer what Gemini reported, where Codex changed code, how the issue was resolved, and which issues still need optimization without searching transient CI logs.

## Enforcement

- `codex-auto-fix` writes the ledger before PR feedback commit/push.
- `--disable-changelog` disables changelog and ledger writes for tests or dry tooling.
- E2E coverage: `auto_fix_local_records_review_issue_solution_ledger_when_docs_enabled`.
