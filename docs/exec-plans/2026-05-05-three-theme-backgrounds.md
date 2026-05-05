# Three Theme Backgrounds

Date: 2026-05-05

## Intent

Give the existing dark, light, and purple themes distinctive, polished page backgrounds while preserving the current routes, layout structure, theme store, and interaction behavior.

## Assumptions

- The three requested themes are the existing `dark`, `light`, and `purple` modes.
- Background changes should be token-first so pages keep using the current shared layout surface.
- The files page should receive the same themed background treatment instead of remaining a flat solid color.

## Risks

- Stronger gradients can reduce text contrast if opacity is too high.
- macOS platform overrides can flatten app backgrounds in Tauri windows.
- Tailwind background-color utilities cannot render multi-layer gradients, so gradient tokens must be consumed as image/background values.

## Dependencies

- `frontend/src/styles/tokens.css`
- `frontend/src/components/layout/PageLayout.tsx`
- `frontend/src/styles/lightThemeTokens.test.ts`
- `docs/quality-score.md`

## Execution Plan

1. Add regression tests that dark, light, and purple page surface tokens use rich multi-layer backgrounds.
2. Add regression tests that file-list page backgrounds are image-capable themed surfaces.
3. Update background tokens for all three themes with distinct visual directions.
4. Update `PageLayout` so the file-list background token can render gradients.
5. Run focused tests, then broader frontend checks that are practical in this workspace.
6. Capture visual evidence if a local frontend server can run.
7. Update `docs/quality-score.md` with the task result and verification notes.

## Verification Commands

- `npm run test -- src/styles/lightThemeTokens.test.ts`
- `npm run check:tokens:strict:layout`
- `npm run lint`
- `git diff --check`
- `npm run build`

