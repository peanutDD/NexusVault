# C-069: Auto Review Ledger Module Boundary

## Rule

`scripts/codex-cli` review ledger audit behavior must live in `scripts/codex-cli/src/review_ledger.rs`.

The module owns:

- global and per-PR/local ledger path selection
- ledger Markdown rendering
- full issue audit status construction
- Low/Info `tracked` semantics
- source-fix detection used to avoid misreporting docs-only ledger writes as code fixes

`repo.rs` may only provide low-level repository-safe file I/O helpers. `skills.rs` and `runtime.rs` may call `review_ledger`, but must not duplicate ledger audit rules.

## Why

The previous implementation spread ledger behavior across `repo.rs`, `skills.rs`, and `runtime.rs`. That made it easy to regress into recording only successful auto-fix results, skipping Low/Info issues, or failing to write audit records when no source fix applied.

## Regression Test

`scripts/codex-cli/tests/review_ledger.rs` locks:

- stable scoped ledger paths
- all audit table columns
- Low/Info as `tracked`, not pending blockers
- resolved explanations using `修复摘要`

Existing E2E tests must also continue to prove that both global and scoped ledger files are written.
