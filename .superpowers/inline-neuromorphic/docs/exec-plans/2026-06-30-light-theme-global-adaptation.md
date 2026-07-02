# 2026-06-30 Light Theme Global Adaptation

## Intent

Fix light mode theme contrast across the frontend without changing dark mode, layout, or business behavior. The visible failures are low-contrast white controls/text on light neuromorphic surfaces, including file cards, selection chips, Audit Center, Settings, Trash, and Upload overlays.

## Assumptions

- The active target is `.superpowers/inline-neuromorphic`.
- The bug is primarily theme-token and CSS-primitive drift, not component behavior.
- Dark mode must keep its current token block and visual contract.
- The existing dirty worktree contains unrelated changes and must not be reverted.

## Risks

- `tokens.css` has multiple light-mode overrides inside one selector; the later CodePen Neuromorphic section wins.
- Some component CSS still hardcodes light/dark colors and can bypass tokens.
- Existing full frontend tests have unrelated failures, so focused evidence must separate new regressions from pre-existing failures.

## Plan

1. Add RED tests for light mode contrast-critical tokens and CSS consumption paths.
2. Update only light-mode token overrides and light-specific variable hooks.
3. Route Upload modal backdrop through a theme variable while preserving the previous default for non-light themes.
4. Verify focused theme/component tests, lint, build, and browser screenshots if the dev server can run.
5. Add a permanent constraint and update `docs/quality-score.md`.

## Non-goals

- No DOM, layout, routing, API, or behavior changes.
- No dark theme retuning.
- No broad refactor outside theme primitives.
