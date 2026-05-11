# Exec Plan: Auto Review Ledger Module Boundary

## Goal

Upgrade the `scripts/codex-cli` auto-review ledger into a dedicated Rust module at `scripts/codex-cli/src/review_ledger.rs`.

The module owns review audit status construction, ledger Markdown rendering, scoped per-PR/local ledger paths, and ledger writes. `repo.rs` remains a low-level repository-safe I/O layer only.

## Assumptions

- Existing full-audit behavior from C-067 remains correct: all severities are recorded, Low/Info are tracked, and no-source-fix runs still write ledger records.
- `--disable-changelog` continues to disable changelog and ledger writes together.
- The implementation runs in an isolated worktree on branch `codex/review-ledger-module`.
- Existing JSON consumers rely on the current `ReviewIssueStatus` fields, so fields are not removed.

## Risks

- Moving status helpers out of `skills.rs` can accidentally change PR comment summaries.
- Moving ledger writes out of `repo.rs` can regress the symlink write boundary fixed by C-068.
- Adding ledger files to `fixed_files` must not make final JSON `fixed=true` when no source issue was fixed.

## Implementation

1. Add module tests for stable scoped paths, full audit columns, Low/Info tracked behavior, and resolved fix summaries.
2. Create `review_ledger.rs` and move ledger rendering, scoped path, append logic, issue statuses, pending count, and source-fix detection into it.
3. Keep `repo.rs` focused on safe repo file I/O, adding a parent-creating safe write helper used by ledger writes.
4. Update `runtime.rs` and `skills.rs` to consume `review_ledger`.
5. Add a permanent constraint preventing ledger audit logic from drifting back into `repo.rs` or `skills.rs`.

## Acceptance

- `cd scripts/codex-cli && cargo fmt --all -- --check`
- `cd scripts/codex-cli && cargo test --all`
- `cd scripts/codex-cli && cargo clippy --all-targets --all-features -- -D warnings`
- New module tests pass and existing E2E ledger tests continue to pass.
