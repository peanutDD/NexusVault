# C-067: Auto Review Ledger Must Be a Full PR Audit Archive

`codex-auto-fix` must preserve a complete per-PR review audit trail, not only a partial list of successfully fixed actionable issues.

Required behavior:

- Per-PR ledgers under `docs/auto-review-ledgers/pr-<number>.md` must include every parsed review issue, including Low and Info severities.
- Local dry-runs must follow the same audit behavior under `docs/auto-review-ledgers/local.md`.
- A ledger entry must be written whenever review issues exist, even if no source file was changed.
- Each issue row must retain the original problem, suggestion, constraints, whether it entered auto-fix scope, final status, repair method or failure reason, and related files when known.
- Resolved explanations must be meaningful repair summaries, not only `已自动修复`.

Rationale:

On 2026-05-11, the ledger was found to behave like a current-PR partial fix note: it skipped Low/Info issues, skipped all entries when no file was fixed, and recorded resolved issues with a generic answer. That made it unsuitable as a PR review archive.

