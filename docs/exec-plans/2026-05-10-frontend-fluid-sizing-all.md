# Frontend Full Fluid Sizing Exec Plan

## Intent

Make the whole frontend adapt to different viewport sizes while preserving every
page's current layout, visual hierarchy, and interaction flow.

## Execution Status

- Status: implemented in the approved batch on 2026-05-10.
- Governance: `check-fluid-sizing.mjs` now has full Tailwind visual scale
  detection via `--scope=tailwind-visual`, with scoped file-list/Trash and
  shell/common gates.
- UI migration: shared shell/common, auth, dialogs, file grid/list, Trash,
  upload, preview, Settings, and Share visual Tailwind dimensions were migrated
  from fixed scale aliases to explicit responsive `clamp()`/semantic values.
- Layout preservation: grid column counts, route/page structure, modal ordering,
  action ordering, sticky Trash console behavior, and existing breakpoints were
  kept unchanged.
- Verification:
  - `npm run check:fluid-sizing -- --scope=tailwind-visual`
  - `npm run check:fluid-sizing -- --scope=all`
  - `npx vitest run scripts/check-fluid-sizing.test.mjs`
  - `npm test`
  - `npm run lint`
  - `npm run build`
- Browser smoke screenshots:
  - `docs/exec-plans/2026-05-10-fluid-login-mobile.png`
  - `docs/exec-plans/2026-05-10-fluid-trash-mobile.png`
  - `docs/exec-plans/2026-05-10-fluid-settings-mobile.png`

## Current Baseline

- `npm run check:fluid-sizing -- --scope=all` already passes, so fixed `px`
  visual dimensions are not the remaining main risk.
- `html` already uses fluid root sizing:
  `font-size: clamp(0.875rem, 1.1vw + 0.5625rem, 1.25rem)`.
- Most remaining fixed-looking dimensions are Tailwind scale utilities such as
  `p-4`, `h-10`, `w-12`, `gap-3`, `rounded-lg`, `max-w-md`, and text-size
  aliases like `text-sm`.
- Because Tailwind scale utilities compile to `rem`, they already respond
  through the fluid root font size. This plan tightens governance and converts
  the remaining user-visible fixed scale choices into explicit semantic tokens
  or `clamp()` where layout quality benefits from per-component bounds.

## Assumptions

- "Keep layout unchanged" means grid counts, toolbar ordering, modal hierarchy,
  card proportions, sticky/fixed surfaces, and breakpoints stay as they are.
- Hairlines (`1px`, `2px`), pill radii (`999px`), observer root margins, canvas
  buffer sizes, and offscreen clipboard staging can remain fixed when documented
  with `fluid-sizing-allow`.
- Existing semantic variables in `tokens.css`, page/domain CSS files, and
  component-local CSS should be preferred over adding new one-off Tailwind
  arbitrary values.
- This should ship as multiple small PRs rather than one huge PR, because the
  project has 235 frontend source style/component files and screenshot drift
  risk is high.

## Risks

- Blindly replacing every Tailwind utility with `clamp()` can change the layout
  even if the numeric midpoint matches.
- Over-governing utility classes can block valid non-visual values such as
  z-index, opacity, flex, grid columns, duration, animation, and scale.
- Preview surfaces and mobile PDF/image interactions have special viewport math;
  they need browser screenshots, not only unit tests.
- Dialogs are shared by destructive workflows; spacing changes must preserve
  button visibility and text wrapping on mobile.

## Dependencies

- `frontend/scripts/check-fluid-sizing.mjs`
- `frontend/scripts/check-fluid-sizing.test.mjs`
- `frontend/src/styles/tokens.css`
- `frontend/src/styles/base.css`
- `frontend/src/styles/cta.css`
- `frontend/src/styles/nav.css`
- `frontend/src/components/layout/*`
- `frontend/src/pages/*`
- `frontend/src/components/common/**`
- `frontend/src/components/settings/**`
- `frontend/src/components/files/grid/**`
- `frontend/src/components/files/list/**`
- `frontend/src/components/files/dialogs/**`
- `frontend/src/components/files/upload/**`
- `frontend/src/components/files/preview/**`
- Browser screenshots for `/files`, `/trash`, `/settings`, `/share/:token`,
  upload dialog, common dialogs, and preview overlays.

## Execution Strategy

### Phase 1: Governance Expansion

1. Add a second mode to `check-fluid-sizing.mjs`:
   `--scope=tailwind-visual`.
2. Detect only user-visible fixed Tailwind visual scale utilities:
   spacing, width/height/min/max, inset, translate, text aliases, radius, blur,
   and scroll margins.
3. Do not flag non-visual numeric utilities:
   grid column counts, z-index, opacity, font weight, leading/tracking aliases,
   animation duration, scale, order, flex, grow/shrink, and ring width.
4. Add allow comments:
   `fluid-sizing-allow: <reason>` and optional file-level allow blocks for
   rendering/math-only exceptions.
5. Red test:
   `node frontend/scripts/check-fluid-sizing.test.mjs` must fail on `p-4`,
   `h-10`, `max-w-md`, and `text-sm` in enforced scopes.
6. Green implementation:
   make `npm run check:fluid-sizing -- --scope=tailwind-visual` report current
   violations with file and line numbers.

### Phase 2: Shared Tokens And Layout Shell

1. Add semantic fluid tokens in `tokens.css` for shell spacing, toolbar padding,
   control size, icon size, dialog padding, and card spacing.
2. Convert `PageLayout`, `NavBar`, `BottomBar`, `Button`, `EmptyState`,
   `ErrorMessage`, `Spinner`, compatibility warning, and auth/loading shells.
3. Preserve existing visual midpoint by choosing clamp min/mid/max values from
   the current Tailwind rem output.
4. Tests:
   component tests assert token classes where practical; screenshot compare
   `/files`, `/trash`, `/settings` at 390, 768, and 1365 widths.

### Phase 3: File List And Trash Domain

1. Convert file/folder cards, virtualized rows, list toolbars, batch bars,
   pagination sentinels, and Trash console/card spacing to semantic fluid tokens.
2. Keep grid breakpoints unchanged:
   `grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10`.
3. Keep Trash-specific restore/permanent-delete buttons inside cards.
4. Tests:
   focused `FileCard`, `FolderCard`, `FileListHeader`, `Trash`, and virtualized
   grid tests; browser evidence for `/files` and `/trash`.

### Phase 4: Dialogs, Share, Settings, Upload

1. Convert common dialogs and file dialogs first, then upload dialog surfaces,
   then Settings and Share pages.
2. Keep modal max-width hierarchy unchanged by replacing fixed aliases with
   `min()`/`clamp()` tokens.
3. Preserve mobile wrapping and button order.
4. Tests:
   dialog regression tests, Settings regression tests, upload dialog layout
   tests, plus browser screenshots for modal and mobile states.

### Phase 5: Preview Domain

1. Convert preview toolbar, floating controls, text panel, unsupported preview,
   mobile PDF controls, and stage decorations.
2. Keep viewport-relative stage sizing such as `min(72vh,44rem)` where it is
   already fluid.
3. Keep pan/zoom runtime CSS variables such as `--preview-pan-x: 0px` as
   interaction state exceptions, documented with tests or allow comments.
4. Tests:
   preview component tests, image pan tests, PDF/mobile preview screenshots.

### Phase 6: Enforce Whole Frontend

1. Run and fix:
   - `npm run check:fluid-sizing -- --scope=all`
   - `npm run check:fluid-sizing -- --scope=tailwind-visual`
   - `npm test`
   - `npm run lint`
   - `npm run build`
2. Add the new tailwind visual scope to CI only after all intentional exceptions
   are documented.
3. Update `docs/constraints/C-030-fluid-sizing-governance.md` with the new
   Tailwind visual rule and allowed exceptions.
4. Update `docs/quality-score.md`.

## TDD Acceptance Criteria

- The new governance test fails before script support is added and passes after.
- Each migrated domain has at least one focused regression test asserting the new
  semantic token or fluid class contract.
- Browser evidence shows no layout shift in the primary flows at mobile, tablet,
  and desktop widths.
- Full frontend build and lint pass.

## Runtime Evidence To Capture

- `/files`: desktop, tablet, mobile.
- `/trash`: desktop, tablet, mobile, including sticky console after scroll.
- `/settings`: desktop and mobile.
- Upload dialog: desktop and mobile.
- A destructive confirm dialog: desktop and mobile.
- File preview overlay: desktop and mobile where supported.

## Recommendation

Execute this as a sequence of small PRs:

1. Governance script and documentation.
2. Shared shell/common components.
3. File list and Trash.
4. Dialogs, Upload, Settings, Share.
5. Preview domain.
6. CI enforcement and final screenshot evidence.
