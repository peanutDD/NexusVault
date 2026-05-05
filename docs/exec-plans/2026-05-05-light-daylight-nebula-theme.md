# Light Daylight Nebula Theme

Date: 2026-05-05

## Intent

Retune the existing light theme into a Daylight Nebula visual style: pale stellar surfaces, cyan/sky/violet highlights, glassy panels, and stronger cosmic button accents.

## Assumptions

- Layout must not change: no DOM structure, route, prop, spacing, sizing, or component hierarchy edits.
- Theme storage remains `light | dark | purple`.
- Visual changes are limited to CSS tokens and existing light-only style hooks.

## Risks

- Stronger nebula effects can reduce contrast on light backgrounds.
- `tokens.css` is broad, so a poor token choice can affect file list, dialogs, upload, settings, and auth at once.
- Fluid sizing governance must keep any visible dimensions in `clamp()`, `rem`, viewport units, or existing semantic tokens.

## Dependencies

- Frontend theme token system in `frontend/src/styles/tokens.css`.
- Existing light theme class application in `frontend/src/store/themeStore.ts`.
- Existing component CSS in `frontend/src/styles/nav.css`, `frontend/src/components/files/list/FileListGlass.css`, and `frontend/src/components/files/upload/UploadDialog.css`.

## Execution Plan

1. Add a token regression test that fails until light theme uses the Daylight Nebula palette.
2. Update only light theme visual tokens in `frontend/src/styles/tokens.css`.
3. Tune `frontend/src/styles/nav.css` light-only button visuals only if needed, without changing dimensions.
4. Run targeted and full frontend checks.
5. Capture `/files` and `/settings` light-mode screenshots at desktop and mobile widths.

## Verification Commands

- `npm run test -- src/styles/lightThemeTokens.test.ts`
- `npm run test -- src/components/settings/SettingsPageRegression.test.tsx`
- `npm run check:tokens:strict:layout`
- `npm run check:fluid-sizing -- --scope=all`
- `npm run lint`
- `npm run test`
- `npm run build`

## Screenshot Evidence

To be captured after implementation:

- `docs/exec-plans/2026-05-05-light-daylight-nebula-files-desktop.png`
- `docs/exec-plans/2026-05-05-light-daylight-nebula-files-mobile.png`
- `docs/exec-plans/2026-05-05-light-daylight-nebula-settings-desktop.png`
- `docs/exec-plans/2026-05-05-light-daylight-nebula-settings-mobile.png`
