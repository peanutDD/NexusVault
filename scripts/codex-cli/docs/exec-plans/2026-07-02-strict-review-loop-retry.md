# Strict Review Loop Retry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Gemini Code Assist `Medium`/`Medium+`/`High`/`Critical` findings block clean/merge status until they are resolved, while clearly labeling external failures and allowing manual third-or-later runs.

**Architecture:** Keep the existing `Types -> Config -> Repo -> Service -> Runtime -> UI` layering. Runtime and workflow state own final policy decisions; ledger/comment rendering consumes the same issue status model so PR comments and local records cannot drift.

**Tech Stack:** Rust 2024 CLI, Bash GitHub Actions state script, GitHub Actions workflow, `cargo test`.

---

## Scope

- In scope:
  - Make strict review policy the default for PR automation.
  - Preserve the default two-round automatic budget, but allow manual third-or-later runs.
  - Mark non-resolved actionable issues with specific failure class, cause, retryability, and remediation.
  - Ensure `blocked_push` includes exact stage, error summary, blocked action, and solution.
  - Update PR comments and local ledger documentation to match the same status source.
- Out of scope:
  - Fixing application Gemini findings in backend/frontend code.
  - Reverting unrelated dirty worktree changes.
  - Deploying, force-pushing, or resolving GitHub review threads.

## Assumptions, Risks, Dependencies, Unknowns

- Assumptions:
  - `scripts/codex-cli` target files are clean before this task starts.
  - The repo branch is not `main`/`master`; work proceeds in place to avoid disturbing the large existing dirty tree.
  - `gh` may not be authenticated locally; PR comment publishing is verified with existing fake `gh` tests unless a real PR is available and explicitly confirmed.
- Risks:
  - Some existing tests encode relaxed mode as desired behavior and must be inverted.
  - Workflow labels and comments are user-facing, so wording must be stable and actionable.
  - External failures can happen at many stages; classification must be conservative.
- Dependencies:
  - Rust toolchain with `cargo`.
  - Existing fake-agent e2e test harness.
  - Existing `.github/scripts/codex-auto-fix-state.sh` plan mode tests.
- Unknowns:
  - Real PR number for live GitHub comment generation.
  - Whether local `gh` auth is configured.

## Likely Files

- Modify: `.github/scripts/codex-auto-fix-state.sh`
- Modify: `.github/workflows/codex-auto-fix.yml`
- Modify: `scripts/codex-cli/src/runtime.rs`
- Modify: `scripts/codex-cli/src/skills.rs`
- Modify: `scripts/codex-cli/src/review_ledger.rs`
- Modify: `scripts/codex-cli/tests/workflow_state.rs`
- Modify: `scripts/codex-cli/tests/e2e_auto_fix.rs`
- Modify: `scripts/codex-cli/tests/review_ledger.rs`
- Modify: `scripts/codex-cli/docs/references/auto-review-usage.md`
- Modify: `scripts/codex-cli/docs/references/configuration.md`
- Modify: `scripts/codex-cli/docs/references/troubleshooting.md`
- Add: `scripts/codex-cli/docs/constraints/codex-auto-fix-actionable-findings-must-block.md`

## Test Strategy

- First failing test:
  - Change `workflow_state::relaxed_pending_without_fix_clears_review_state` to require `needs_human`, `ready_to_merge=false`, and actionable remediation text.
- Additional failing tests:
  - `blocked_push` JSON/comment/ledger includes stage, raw error summary, blocked action, retryability, and solution.
  - External/runtime budget failure is marked as retryable external blockage and never clean.
  - Manual round 3+ is allowed when explicitly requested or current label exceeds the default max.
  - PR status table and ledger render the same issue status data.

## Verification Commands

Run from `.superpowers/inline-neuromorphic/scripts/codex-cli`:

```bash
cargo test --test workflow_state
cargo test --test e2e_auto_fix
cargo test --test review_ledger
cargo test --test review_to_json
cargo test
cargo fmt -- --check
```

If a command is unavailable, record the missing dependency and run the strongest available subset.

## Observability Evidence Expected

- Test output for state transitions and e2e JSON fields.
- PR comment body captured by fake `gh`, showing status table plus resolved/unresolved/blocked details.
- Ledger content showing the same actionable issue statuses.
- Final diff summary.

## Rollback / Snapshot Strategy

- Target paths were checked clean before edits.
- Keep edits limited to listed files.
- If rollback is needed, revert only files touched by this task using the final diff as the boundary; do not touch unrelated dirty worktree files.

## Human Approval

Approved by the user on 2026-07-02 after two adjustments:

- External failures must be labeled, not treated as clean, and manual third-or-later runs must be possible.
- `blocked_push` and all failure states must include concrete cause, remediation, retryability, and suggested next action.

## Tasks

### Task 1: State Machine RED/GREEN

- [ ] Add failing workflow tests for pending, external blocked, push blocked, and manual round 3 behavior.
- [ ] Run `cargo test --test workflow_state` and confirm expected failures.
- [ ] Update `.github/scripts/codex-auto-fix-state.sh` and workflow env defaults.
- [ ] Re-run `cargo test --test workflow_state`.

### Task 2: Runtime Status Metadata RED/GREEN

- [ ] Add failing e2e/review ledger tests for failure class, retryability, remediation, and blocked action.
- [ ] Run targeted tests and confirm expected failures.
- [ ] Update Rust status model/rendering.
- [ ] Re-run targeted tests.

### Task 3: Docs And Constraints

- [ ] Add permanent constraint for actionable review findings.
- [ ] Update usage/config/troubleshooting docs for two-round budget, external blockage, blocked push, and manual reruns.
- [ ] Run doc-related tests if present.

### Task 4: Verification And Self-Review

- [ ] Run all verification commands.
- [ ] Inspect `git diff -- scripts/codex-cli .github/scripts/codex-auto-fix-state.sh .github/workflows/codex-auto-fix.yml`.
- [ ] Record evidence and remaining risk in final handoff.
