# CI Audit and Frontend Review Validation Plan

Date: 2026-07-03
Branch: `codex/ci-audit-frontend-review-20260703`

## Goal

Fix the failing `Security audit (cargo-audit)` and `Frontend (Node)` automation checks, then open a new PR based on the latest frontend neuromorphic changes to validate the automated review loop.

## Out of Scope

- Merging the PR.
- Changing repository secrets, GitHub App configuration, or deployment settings.
- Force-pushing or rewriting existing shared branches.
- Changing runtime UI behavior unless a verified test failure requires it.

## Assumptions and Risks

- The new PR targets `origin/main`.
- `cargo-audit` failures are dependency and validation-derive maintenance issues.
- Frontend failures are stale test contracts from recent modal and CSS refactors.
- Dependency upgrades may require small API compatibility changes.
- GitHub automation can fail for external reasons such as network, runner availability, or service quota; those failures must be reported with cause and next action.

## Likely Changed Areas

- `backend/Cargo.toml`
- `backend/Cargo.lock`
- `backend/src/types/user.rs`
- `backend/src/types/api_token.rs`
- `frontend/src/styles/mobileZoomPrevention.test.ts`
- `frontend/src/components/files/dialogs/ShareDialog.test.tsx`
- `docs/constraints/`
- `docs/quality-score.md`

## Test Strategy

Known failing checks before implementation:

- `cd backend && cargo audit --deny warnings`
- `cd frontend && npm test -- --run src/styles/mobileZoomPrevention.test.ts src/components/files/dialogs/ShareDialog.test.tsx`

Implementation verification:

- Add or preserve backend validation tests for the request DTOs affected by removing `validator` derive macros.
- Make the two targeted frontend tests assert stable behavior instead of brittle implementation details.

## Verification Commands

- `cd backend && cargo audit --deny warnings`
- `cd backend && cargo test`
- `cd backend && cargo check`
- `cd frontend && npm test -- --run src/styles/mobileZoomPrevention.test.ts src/components/files/dialogs/ShareDialog.test.tsx`
- `cd frontend && npm run lint`
- `cd frontend && npx tsc -b --noEmit`

## Observability Evidence

- Local terminal output from audit, test, lint, and typecheck commands.
- GitHub Actions results on the new PR.
- Automated review PR comment or failure status if the review loop cannot complete.

## Rollback Strategy

Work happens in an isolated worktree at `/tmp/nexusvault-ci-audit-frontend-review-20260703`. If the approach fails, revert only this branch's changes or abandon the branch/worktree without touching existing PR branches.
