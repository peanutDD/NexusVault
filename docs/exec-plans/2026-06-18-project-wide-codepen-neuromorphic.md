# Project-Wide CodePen Neuromorphic Exec-Plan

Date: 2026-06-18
Status: awaiting execution-mode approval
Detailed plan: `docs/superpowers/plans/2026-06-18-project-wide-codepen-neuromorphic.md`
Approved design: `docs/superpowers/specs/2026-06-18-project-wide-codepen-neuromorphic-design.md`

## Objective

Apply one pure CodePen-style Neuromorphic surface system to all ten frontend
routes and shared components in light and dark themes, with no residual visible
borders, surface gradients, glass/tech decoration, or page-specific depth
systems.

## Assumptions

- User-provided CodePen screenshots are the visual authority when remote page
  automation is unavailable.
- Business behavior, API contracts, routing, auth, upload, preview, filtering,
  pagination, and accessibility semantics must remain unchanged.
- Semantic action/status colors remain, using pure fills and global shadow
  direction.
- Existing authenticated local browser state can be used for visual evidence.

## Risks

- The worktree contains extensive unrelated and uncommitted changes.
- Global token changes affect every visible surface.
- Existing CSS has duplicate Share, Activity, Settings, Trash, file-list,
  upload, preview, and dialog surface systems.
- Mobile clipping and light-theme contrast can regress during cleanup.
- The complete change exceeds one 300-line PR and must remain split into
  reviewable batches.

## Dependencies

- Isolated branch/worktree `codex/project-wide-codepen-neuromorphic`
- Current in-scope frontend state synchronized without unrelated changes
- Chrome access to the reference and local app
- Frontend/backend development servers and representative local data
- Vitest, ESLint, TypeScript, token checks, fluid-sizing checks, Vite, ffmpeg

## Execution Batches

1. Baseline and isolated worktree.
2. Global flat/raised/inset/pressed primitive tokens and CSS.
3. Shared page chrome, controls, dialogs, feedback, and auth.
4. Files page, list/grid, filters, cards, menus, and selection.
5. Upload, file dialogs, preview, PDF, and floating controls.
6. Settings, Share, Shares, Activity, Trash, and File Request.
7. Permanent residue scanner, constraint C-310, full CI, and coverage.
8. Light/dark desktop/mobile route matrix, comparison video, quality score,
   final PR, and review request.

## TDD Contract

Every batch follows:

1. Add or update a focused failing test.
2. Run it and record the expected RED reason.
3. Implement only the batch's visual mapping.
4. Run focused GREEN tests without weakening behavior assertions.
5. Run lint, TypeScript, fluid sizing, and build in proportion to blast radius.
6. Capture browser evidence, then commit only the batch files.

## Completion Gates

- All active ordinary surfaces resolve to the global primitives.
- Computed ordinary-surface border is transparent or zero.
- Ordinary-surface `background-image` is `none`.
- Light source direction is consistent in both themes and all component
  families.
- All ten routes pass light/dark and desktop/mobile rendered checks.
- No new browser console error/warning or framework overlay.
- Tests, strict token checks, residue audit, lint, TypeScript, fluid sizing, and
  build pass.
- New executable audit code has at least 90% coverage.
- Before/after screenshots and video are stored in docs evidence.
- Final quality score is at least 95/100.

## Rollback

Each batch is a separate commit. Revert only the failing batch commit after
capturing the failure evidence; never reset or revert unrelated dirty worktree
changes.
