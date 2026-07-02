# 2026-06-30 Auth ShapeWave and FileList Fireworks Restore

## Intent
Restore the previously removed login/register ShapeWave background and the Files page fireworks background without changing page layout, foreground controls, navigation, or business behavior.

## Assumptions
- The desired animations are the historical `AuthShapeWaveBackground`, shared `ShapeWaveBackground`, and `FileListPortfolioFireworksBackground` components from the `0a1f8c3` frontend baseline.
- The Files page should restore only the fireworks background, not the older list ShapeWave or light canvas backgrounds.
- Decorative backgrounds must remain inert: `aria-hidden`, `pointer-events-none`, fixed behind foreground content, and compatible with reduced-motion preferences.

## Risks
- Restoring a shared canvas component can accidentally bring back old list ShapeWave token references.
- Auth pages can be visually affected if the background is mounted above the form or captures pointer events.
- The current worktree has unrelated failing contract tests; verification must distinguish existing failures from this restore.

## Plan
1. Add failing tests that require auth ShapeWave and file-list fireworks backgrounds to exist.
2. Restore the historical background component files by path.
3. Mount auth ShapeWave behind Login/Register foreground content.
4. Mount fireworks through the existing `FileListBackgroundLayer`.
5. Restore only the required auth ShapeWave tokens.
6. Update obsolete tests so they guard decorative/inert behavior instead of removal.
7. Run focused tests, lint, fluid sizing, build, and a browser render probe for Login.

## Verification
- `npm --prefix frontend run test -- AuthShapeWavePages AuthShapeWaveBackground FileListBackgroundLayer FileListPortfolioFireworksBackground AuthNeuromorphic lightThemeTokens`
- `npm --prefix frontend run test -- WebDavAccessSection -t "formats HTTP result chips"`
- `npm --prefix frontend run lint -- --quiet`
- `npm --prefix frontend run check:fluid-sizing`
- `npm --prefix frontend run build`
- System Chrome Playwright probe for `/login`: background canvas exists, paints, is fixed, has `pointer-events: none`, and the email input remains focusable.

## Residuals
- Full `npm --prefix frontend run test` currently fails 31 existing unrelated tests across Activity, FileRequest, Shares, Trash, Settings, Preview, and other old contract assertions.
- `check:tokens`, `check:neuromorphic`, and `check:hardcoding` also fail on existing unrelated hardcoded color/surface findings outside this restore.
