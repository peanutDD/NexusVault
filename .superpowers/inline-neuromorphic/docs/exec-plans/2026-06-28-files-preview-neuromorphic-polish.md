# Files / Preview Neuromorphic Polish

Date: 2026-06-28

## Intent

Polish the Files home and Preview UI to match the Neuromorphic UI direction while keeping dimensions fluid, fixing the collection-chip collapse trigger bug, improving contrast, and making unsupported preview states feel consistent with home file cards.

## Assumptions

- The target app is the React frontend under `frontend/`.
- The CodePen reference is a visual reference for filled purple selected controls; local Chrome access may be unstable, so the supplied screenshots remain authoritative.
- Existing dirty worktree changes are user-owned unless explicitly changed by this task.
- The current project permits source-contract tests for CSS/UI invariants where visual state is difficult to assert in JSDOM.

## Risks

- File list components are shared by desktop and mobile layouts; changes must stay scoped to component classes and avoid fixed pixel sizing.
- Some existing full-suite tests are already failing outside this task; targeted tests are required to verify the touched surface.
- Contrast token changes can affect multiple screens, so only the file/filter/preview semantic tokens should be adjusted.

## Dependencies

- `frontend/src/components/files/list/*`
- `frontend/src/components/files/grid/*`
- `frontend/src/components/files/preview/*`
- `frontend/src/components/files/list/FileListGlass.css`
- `frontend/src/components/files/list/FileListFilters.css`
- `frontend/src/styles/preview.css`
- `frontend/src/styles/tokens.css`

## Plan

1. Add targeted tests for collection chip event isolation, toolbar control sizing, search focus groove styling, action menu rhythm, unsupported preview card layout, selected checkbox style, and SSTV label/rule consistency.
2. Implement scoped UI fixes using existing neuromorphic primitives and clamp/rem/container-relative sizing.
3. Improve file/filter/preview text contrast through semantic tokens only.
4. Run targeted tests for touched components and a broader frontend check where feasible.
5. Add a permanent constraint and update the quality score with verification notes.
