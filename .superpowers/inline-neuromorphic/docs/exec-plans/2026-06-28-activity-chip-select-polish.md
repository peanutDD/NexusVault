# Activity Chip Select Polish Exec Plan

Date: 2026-06-28

## Scope

Fix the Files collection chip collapse regression, flatten Activity `NeuSelect`
option lists with explicit hover/selected states, and polish the Activity error
guidance/action layout.

## Assumptions

- Work is limited to `.superpowers/inline-neuromorphic`.
- The target checkout is already an isolated git worktree.
- Existing Activity ID-prefix validation, local-day date boundaries, and refresh
  filter preservation remain unchanged.
- Error-state reload and clear-filter actions should visually match the bottom
  green refresh button.

## Risks

- `NeuSelect` is shared, so tests must lock the Activity use case.
- Collection chips use hidden measurement nodes; fixes must not break overflow
  measurement.
- The worktree has broad unrelated changes; validation may expose existing
  failures outside this task.

## Dependencies

- Existing frontend Vitest tests for Activity and FileList selection.
- Existing Neuromorphic primitives and fluid sizing checks.
- Browser or Playwright validation for rendered UI behavior.

## Steps

1. Add failing tests for chip click isolation, flat select option classes, and
   Activity error guidance layout/actions.
2. Implement the minimal UI changes.
3. Run focused tests, lint/build/check scripts where practical, and rendered
   validation.
4. Update `docs/quality-score.md` with final evidence and residual risks.
