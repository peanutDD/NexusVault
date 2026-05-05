# Light Tech Chrome Nav Footer

Date: 2026-05-05

## Intent

Redesign the light-mode top title/navigation bar and bottom display/footer bar into a premium technology chrome style while preserving the existing layout, DOM structure, spacing, sizing, and routing.

## Assumptions

- The request targets light mode visuals, continuing the Daylight Nebula theme work.
- "Layout must not move" means no DOM structure, hierarchy, spacing, sizing, route, prop, store, or persistence changes.
- Token and existing CSS visual hooks may change color, gradients, shadows, borders, opacity, and glow.

## Risks

- Deep chrome surfaces in light mode can reduce text contrast if nav and footer text tokens are not retuned together.
- macOS platform overrides can accidentally flatten the nav surface back to plain white.
- Tailwind arbitrary background-color syntax does not render multi-layer gradients, so nav rendering must use the background shorthand without changing layout.

## Dependencies

- `frontend/src/styles/tokens.css`
- `frontend/src/styles/nav.css`
- `frontend/src/styles/platform.css`
- `frontend/src/components/layout/NavBar.tsx`
- `frontend/src/styles/lightThemeTokens.test.ts`

## Execution Plan

1. Add light-theme regression coverage for premium dark chrome nav/footer tokens.
2. Add regression coverage for macOS light title bar overrides.
3. Add regression coverage that the nav uses background shorthand so gradient tokens render.
4. Retune light `--nav-*` and `--footer-*` tokens to deep slate chrome with cyan and violet luminous accents.
5. Tune existing light nav button overrides without changing dimensions.
6. Capture updated `/files` and `/settings` screenshots at desktop and mobile widths.

## Verification Commands

- `npm run test -- src/styles/lightThemeTokens.test.ts`
- `npm run check:tokens:strict:layout`
- `npm run check:fluid-sizing -- --scope=all`
- `npm run lint`
- `git diff --check`
- `npm run build`

## Screenshot Evidence

- `docs/exec-plans/2026-05-05-light-daylight-nebula-files-desktop.png`
- `docs/exec-plans/2026-05-05-light-daylight-nebula-files-mobile.png`
- `docs/exec-plans/2026-05-05-light-daylight-nebula-settings-desktop.png`
- `docs/exec-plans/2026-05-05-light-daylight-nebula-settings-mobile.png`

