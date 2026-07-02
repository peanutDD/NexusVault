# Frontend Neuromorphic Dead Code Cleanup

Date: 2026-07-02

## Intent

Continue the project-wide CodePen Neuromorphic migration by removing proven-dead
frontend visual code without changing business behavior, layout structure, route
coverage, or responsive sizing.

## Assumptions

- The active worktree is `codex/project-wide-codepen-neuromorphic`.
- Backend and unrelated dirty worktree changes are out of scope.
- A file is removable only when production references and test references are
  absent, or when the only references are tests for that same retired component.
- Semantic tokens used by active pages such as Share and Upload must remain.

## Risks

- Static reachability can miss dynamic imports, so TypeScript and focused tests
  must run after deletion.
- Token cleanup can affect active pages if names are shared.
- Decorative-but-active components are not dead code and should not be removed
  during this cleanup pass.

## Dependencies

- `frontend/src/components/common`
- `frontend/src/components/settings`
- `frontend/src/components/files/list`
- `frontend/src/styles/icons.css`
- `frontend/src/styles/tokens.css`
- `frontend/scripts/check-fluid-sizing.mjs`

## Plan

1. Scan imports and active source references for candidate TSX/CSS/assets.
2. Delete only confirmed orphan components/assets and their orphan tests.
3. Remove CSS glyphs and tokens tied exclusively to deleted components.
4. Run TypeScript, focused tests, `check:neuromorphic`, fluid sizing, lint, and
   build.
5. Record the cleanup in constraints and quality score.
