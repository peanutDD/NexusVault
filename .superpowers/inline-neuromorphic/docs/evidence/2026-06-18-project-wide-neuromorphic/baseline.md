# Project-Wide Neuromorphic Baseline

Captured from commit `0a1f8c3` in the isolated worktree on 2026-06-19.

## Runtime

- CI runtime: Node 22
- Local verification runtime: Node 22.21.0 through `mise`
- Install command: `npm ci --ignore-scripts`
- Reason: the unused direct `giframe` dependency installs `canvas@2.11.2`, which has no Node 22 arm64 prebuild and requires the unavailable system `pkg-config` tool. Frontend source has no `giframe` import. Build and tests run without that native install script.

## Baseline Gates

- ESLint: pass
- TypeScript `tsc -b --pretty false`: pass
- `check:fluid-sizing`: pass
- Production build: pass
- Vitest: 586 passed, 10 failed before syncing the current favicon; the favicon contract then passed independently, leaving 9 known failures.

## Known Baseline Test Failures

1. `src/pages/Activity.test.tsx`: complete target filters/status formatting.
2. `src/pages/Files.test.tsx`: scroll-to-top after upload completion.
3. `src/styles/NavBarInnerGlowTokens.test.ts`: two obsolete inner-glow token assertions.
4. `src/styles/darkThemeTokens.test.ts`: current dark surface mapping mismatch.
5. `src/styles/lightThemeTokens.test.ts`: current light component text token mismatch.
6. `src/styles/mobileZoomPrevention.test.ts`: formatting-sensitive global touch-action assertion.
7. `src/components/layout/NavBarInnerGlow.test.ts`: three obsolete hard-coded animation/tooltip assertions.

The migration may resolve obsolete visual-contract failures, but no batch may introduce a new functional failure relative to this list.
