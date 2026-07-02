# Project-Wide CodePen Neuromorphic Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every light and dark frontend surface with one clean CodePen-style Neuromorphic primitive system while preserving all routes, data flow, accessibility, and business behavior.

**Architecture:** Add a single CSS primitive layer for flat, raised, inset, pressed, and semantic-depth surfaces, then map existing component tokens and markup to those primitives in reviewable batches. Remove page-specific `glass`, `tech`, CodePen, Share, Activity, and decorative shadow implementations instead of masking them with a global override. Lock the result with token tests, source-residue tests, component behavior tests, and a complete route/theme/viewport evidence matrix.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, CSS custom properties, Vitest, Testing Library, Vite, Chrome browser verification

---

## File Structure

### New Files

- `frontend/src/styles/neuromorphic.css`: the only reusable flat, raised, inset, pressed, and semantic-depth CSS primitives.
- `frontend/src/styles/neuromorphicPrimitiveContract.test.ts`: exact light/dark token and primitive-rule contract tests.
- `frontend/src/styles/neuromorphicResidueAudit.test.ts`: scans active frontend source for forbidden legacy surface systems.
- `frontend/scripts/check-neuromorphic-surfaces.mjs`: CI-friendly residue audit with readable file and line failures.
- `docs/constraints/C-310-neuromorphic-surfaces-use-one-global-primitive-system.md`: permanent rule preventing page-specific surface systems from returning.
- `docs/evidence/2026-06-18-project-wide-neuromorphic/manifest.md`: route/theme/viewport and interaction-state evidence index.
- `docs/evidence/2026-06-18-project-wide-neuromorphic/judge.md`: visual scoring rubric and result.

### Core Files

- `frontend/src/index.css`: imports `neuromorphic.css` immediately after `tokens.css`.
- `frontend/src/styles/tokens.css`: defines the exact CodePen graphite/cloud base colors and maps every active component surface token to the global primitives.
- `frontend/src/styles/base.css`: removes Share/Activity/Settings duplicate surface systems and retains only page-specific typography or semantic color mappings.
- `frontend/package.json`: adds `check:neuromorphic` and includes it in the documented verification sequence.

### Shared UI Files

- `frontend/src/components/layout/PageLayout.tsx`
- `frontend/src/components/layout/NavBar.tsx`
- `frontend/src/components/layout/BottomBar.tsx`
- `frontend/src/styles/nav.css`
- `frontend/src/styles/platform.css`
- `frontend/src/components/common/Button.tsx`
- `frontend/src/components/common/ThemeToggle.tsx`
- `frontend/src/components/common/NeuSelect.tsx`
- `frontend/src/components/common/NeuDatePicker.tsx`
- `frontend/src/components/common/form/FormField.tsx`
- `frontend/src/components/common/form/SelectionCheckbox.tsx`
- `frontend/src/components/common/dialog/BaseDialog.tsx`
- `frontend/src/components/common/dialog/Modal.tsx`
- `frontend/src/components/common/dialog/ConfirmDialog.tsx`
- `frontend/src/components/common/feedback/ErrorMessage.tsx`
- `frontend/src/components/common/feedback/Skeleton.tsx`
- `frontend/src/components/common/feedback/Spinner.tsx`
- `frontend/src/components/auth/styles.ts`
- `frontend/src/components/auth/Login.tsx`
- `frontend/src/components/auth/Register.tsx`
- `frontend/src/components/auth/GithubCallback.tsx`

### File Workflow Files

- `frontend/src/pages/Files.tsx`
- `frontend/src/components/files/list/FileList.tsx`
- `frontend/src/components/files/list/FileListContent.tsx`
- `frontend/src/components/files/list/FileListHeader.tsx`
- `frontend/src/components/files/list/FileListFilters.tsx`
- `frontend/src/components/files/list/FileListFilters.css`
- `frontend/src/components/files/list/FileListGlass.css`
- `frontend/src/components/files/list/FileListPagination.tsx`
- `frontend/src/components/files/list/FileListSelectionBar.tsx`
- `frontend/src/components/files/list/FileListBatchActions.tsx`
- `frontend/src/components/files/list/FileListCollectionChips.tsx`
- `frontend/src/components/files/list/FileListRow.tsx`
- `frontend/src/components/files/list/FileListGroupHeader.tsx`
- `frontend/src/components/files/list/FileListBackgroundLayer.tsx`
- `frontend/src/components/files/grid/FileCard.tsx`
- `frontend/src/components/files/grid/FolderCard.tsx`
- `frontend/src/components/files/grid/FileGrid.tsx`
- `frontend/src/components/files/grid/FolderGrid.tsx`
- `frontend/src/components/files/grid/MixedGrid.tsx`
- `frontend/src/components/files/grid/VirtualizedFileGrid.tsx`
- `frontend/src/components/files/grid/VirtualizedMixedGrid.tsx`
- `frontend/src/components/files/FolderBreadcrumb.tsx`

### Dialog, Upload, And Preview Files

- `frontend/src/styles/confirm-dialog.css`
- `frontend/src/styles/preview.css`
- `frontend/src/components/files/upload/UploadDialog.css`
- `frontend/src/components/files/upload/UploadFileItem.css`
- `frontend/src/components/files/upload/UploadDialog.tsx`
- `frontend/src/components/files/upload/UploadDropzone.tsx`
- `frontend/src/components/files/upload/UploadFileItem.tsx`
- `frontend/src/components/files/upload/UploadProgressList.tsx`
- `frontend/src/components/files/upload/UrlUploadForm.tsx`
- `frontend/src/components/files/dialogs/BatchMoveDialog.tsx`
- `frontend/src/components/files/dialogs/BatchShareDialog.tsx`
- `frontend/src/components/files/dialogs/CreateFolderDialog.tsx`
- `frontend/src/components/files/dialogs/FileActivityDialog.tsx`
- `frontend/src/components/files/dialogs/ManageTagsDialog.tsx`
- `frontend/src/components/files/dialogs/RenameFileDialog.tsx`
- `frontend/src/components/files/dialogs/RenameFolderDialog.tsx`
- `frontend/src/components/files/dialogs/ShareDialog.tsx`
- `frontend/src/components/files/dialogs/VersionHistoryDialog.tsx`
- `frontend/src/components/files/preview/FilePreview.tsx`
- `frontend/src/components/files/preview/FilePreviewStage.tsx`
- `frontend/src/components/files/preview/FilePreviewStates.tsx`
- `frontend/src/components/files/preview/FilePreviewTextPanel.tsx`
- `frontend/src/components/files/preview/FilePreviewToolbar.tsx`
- `frontend/src/components/files/preview/MobilePdfPreview.tsx`
- `frontend/src/components/files/preview/PdfPreview.tsx`

### Business Page Files

- `frontend/src/pages/Settings.tsx`
- `frontend/src/components/settings/settingsUi.ts`
- `frontend/src/components/settings/SettingsCard.tsx`
- `frontend/src/components/settings/ApiTokenSection.tsx`
- `frontend/src/components/settings/OcrStatusSection.tsx`
- `frontend/src/components/settings/PasswordChangeSection.tsx`
- `frontend/src/components/settings/StorageUsageSection.tsx`
- `frontend/src/components/settings/ThemeSection.tsx`
- `frontend/src/components/settings/UserInfoSection.tsx`
- `frontend/src/components/settings/WebDavAccessSection.tsx`
- `frontend/src/pages/Share.tsx`
- `frontend/src/pages/Shares.tsx`
- `frontend/src/pages/Activity.tsx`
- `frontend/src/pages/Trash.tsx`
- `frontend/src/pages/FileRequest.tsx`

---

### Task 1: Isolate The Work And Capture The Baseline

**Files:**
- Read: `AGENTS.md`
- Read: `docs/superpowers/specs/2026-06-18-project-wide-codepen-neuromorphic-design.md`
- Read: all files listed in the File Structure section
- Create: isolated worktree `codex/project-wide-codepen-neuromorphic`

- [ ] **Step 1: Record the current state before any source edit**

Run:

```bash
git rev-parse HEAD
git status --short
git diff --stat
```

Expected: record commit `8fcb964` or its descendant and preserve all unrelated dirty files exactly as found.

- [ ] **Step 2: Create the isolated worktree**

Use `superpowers:using-git-worktrees`. Create branch `codex/project-wide-codepen-neuromorphic` from the current task commit. Synchronize only the in-scope dirty frontend files listed above into the worktree; do not stage or copy backend, workflow, environment, generated icon, or unrelated documentation changes.

Expected: the new worktree contains the current frontend visual state and `git status --short` lists only intentionally synchronized in-scope files.

- [ ] **Step 3: Capture baseline screenshots**

Start the app:

```bash
npm --prefix frontend run dev -- --host 127.0.0.1 --port 5173
```

Use Chrome to capture `/login`, `/files`, `/settings`, `/activity`, `/shares`, `/trash`, one `/share/:token`, and one `/request/:token` in light and dark at `1440x1000` and `390x844`. Save them under `docs/evidence/2026-06-18-project-wide-neuromorphic/before/`.

Expected: 32 baseline screenshots, plus a manifest row for the GitHub callback loading state.

- [ ] **Step 4: Run the untouched frontend verification suite**

Run:

```bash
npm --prefix frontend run test
npm --prefix frontend run lint
npm --prefix frontend exec -- tsc -b --pretty false
npm --prefix frontend run check:fluid-sizing
npm --prefix frontend run build
```

Expected: record all pre-existing failures separately. New batches may not add failures.

---

### Task 2: Define The Single Primitive System

**Files:**
- Create: `frontend/src/styles/neuromorphic.css`
- Create: `frontend/src/styles/neuromorphicPrimitiveContract.test.ts`
- Modify: `frontend/src/index.css`
- Modify: `frontend/src/styles/tokens.css`
- Modify: `frontend/src/styles/darkThemeTokens.test.ts`
- Modify: `frontend/src/styles/lightThemeTokens.test.ts`

- [ ] **Step 1: Write the failing primitive contract test**

Add these exact token assertions after defining `dark` and `light` with the
same `readToken` parser already shown in this task:

```ts
const expected = {
  dark: {
    surface: "#2d3748",
    shadowDark: "#1a202c",
    shadowLight: "#4a5568",
  },
  light: {
    surface: "#e0e5ec",
    shadowDark: "#bec3c9",
    shadowLight: "#ffffff",
  },
} as const;

expect(readToken(dark, "--neu-surface-bg")).toBe(expected.dark.surface);
expect(readToken(dark, "--neu-raised-bg")).toBe("var(--neu-surface-bg)");
expect(readToken(dark, "--neu-inset-bg")).toBe("var(--neu-surface-bg)");
expect(readToken(dark, "--surface-page-gradient")).toBe("var(--neu-surface-bg)");
expect(readToken(light, "--neu-surface-bg")).toBe(expected.light.surface);
expect(readToken(light, "--neu-raised-bg")).toBe("var(--neu-surface-bg)");
expect(readToken(light, "--neu-inset-bg")).toBe("var(--neu-surface-bg)");
expect(readToken(light, "--surface-page-gradient")).toBe("var(--neu-surface-bg)");
```

Read `neuromorphic.css` and assert `.neu-flat`, `.neu-raised`, `.neu-inset`, `.neu-pressed`, and `.neu-semantic-raised` exist; each must include `border-color: transparent` and `background-image: none` where it supplies a surface.

- [ ] **Step 2: Run the test to verify RED**

Run:

```bash
npm --prefix frontend run test -- neuromorphicPrimitiveContract
```

Expected: FAIL because `--neu-surface-bg` and `neuromorphic.css` do not exist and current surface tokens use gradients.

- [ ] **Step 3: Create the primitive CSS layer**

Create:

```css
@layer components {
  .neu-flat {
    border-color: transparent;
    background: var(--neu-surface-bg);
    background-image: none;
    box-shadow: none;
  }

  .neu-raised {
    border-color: transparent;
    background: var(--neu-raised-bg);
    background-image: none;
    box-shadow: var(--neu-raised-shadow);
  }

  .neu-raised-sm {
    border-color: transparent;
    background: var(--neu-raised-bg);
    background-image: none;
    box-shadow: var(--neu-raised-sm-shadow);
  }

  .neu-inset {
    border-color: transparent;
    background: var(--neu-inset-bg);
    background-image: none;
    box-shadow: var(--neu-inset-shadow);
  }

  .neu-pressed {
    border-color: transparent;
    background: var(--neu-inset-bg);
    background-image: none;
    box-shadow: var(--neu-pressed-shadow);
  }

  .neu-semantic-raised {
    border-color: transparent;
    background-image: none;
    box-shadow: var(--neu-control-shadow);
  }
}
```

Import it in `index.css` directly after `tokens.css`.

- [ ] **Step 4: Replace theme surface gradients with pure CodePen materials**

In both final theme blocks in `tokens.css`, set:

```css
--neu-surface-bg: #2d3748; /* dark */
--neu-bg-primary: var(--neu-surface-bg);
--neu-bg-secondary: var(--neu-surface-bg);
--neu-shadow-dark: #1a202c;
--neu-shadow-light: #4a5568;
--neu-primary: #6366f1;
--neu-primary-dark: #4f46e5;
--neu-raised-bg: var(--neu-surface-bg);
--neu-inset-bg: var(--neu-surface-bg);
--surface-page-gradient: var(--neu-surface-bg);
```

and:

```css
--neu-surface-bg: #e0e5ec; /* light */
--neu-bg-primary: var(--neu-surface-bg);
--neu-bg-secondary: var(--neu-surface-bg);
--neu-shadow-dark: #bec3c9;
--neu-shadow-light: #ffffff;
--neu-primary: #6366f1;
--neu-primary-dark: #4f46e5;
--neu-raised-bg: var(--neu-surface-bg);
--neu-inset-bg: var(--neu-surface-bg);
--surface-page-gradient: var(--neu-surface-bg);
```

Keep the exact shared depth aliases:

```css
--neu-raised-shadow: 8px 8px 16px var(--neu-shadow-dark), -8px -8px 16px var(--neu-shadow-light);
--neu-raised-sm-shadow: 4px 4px 8px var(--neu-shadow-dark), -4px -4px 8px var(--neu-shadow-light);
--neu-inset-shadow: inset 4px 4px 8px var(--neu-shadow-dark), inset -4px -4px 8px var(--neu-shadow-light);
--neu-pressed-shadow: inset 2px 2px 4px var(--neu-shadow-dark), inset -2px -2px 4px var(--neu-shadow-light);
```

- [ ] **Step 5: Update old token assertions and run GREEN**

Replace expectations for `linear-gradient(145deg, var(--neu-bg-primary), var(--neu-bg-secondary))` page and surface tokens with `var(--neu-surface-bg)`. Assert `--neu-primary: #6366f1` and `--neu-primary-dark: #4f46e5` in both themes, and remove semantic action gradient expectations.

Run:

```bash
npm --prefix frontend run test -- neuromorphicPrimitiveContract darkThemeTokens lightThemeTokens
```

Expected: PASS.

- [ ] **Step 6: Commit the primitive batch**

```bash
git add frontend/src/index.css frontend/src/styles/neuromorphic.css frontend/src/styles/neuromorphicPrimitiveContract.test.ts frontend/src/styles/tokens.css frontend/src/styles/darkThemeTokens.test.ts frontend/src/styles/lightThemeTokens.test.ts
git commit -m "feat: establish global neuromorphic primitives"
```

---

### Task 3: Migrate Shared Shells, Controls, Dialogs, And Auth

**Files:**
- Modify: shared UI files listed in File Structure
- Modify: `frontend/src/styles/nav.css`
- Modify: `frontend/src/styles/platform.css`
- Modify: `frontend/src/styles/confirm-dialog.css`
- Test: existing layout, navigation, dialog, form, feedback, theme toggle, and auth tests

- [ ] **Step 1: Write failing shared-surface assertions**

Extend the focused tests with these exact source and render contracts:

```ts
expect(screen.getByTestId("page-layout-shell")).toHaveClass("neu-flat");
expect(screen.getByTestId("nav-panel")).toHaveClass("neu-inset");
expect(screen.getByTestId("bottom-bar")).toHaveClass("neu-raised");
expect(AUTH_CARD_CLASSES).toContain("neu-raised");
expect(AUTH_INPUT_CLASSES).toContain("neu-inset");
```

Add negative assertions for `backdrop-blur`, top/bottom glow lines, side ambience, grid layers, shimmer layers, and persistent non-transparent Neuromorphic borders.

- [ ] **Step 2: Run shared tests to verify RED**

```bash
npm --prefix frontend run test -- PageLayout NavBar BottomBar AuthNeuromorphic FormFieldNeuromorphic BaseDialog Modal ConfirmDialog ThemeToggle ErrorMessage Spinner
```

Expected: FAIL on missing primitive classes and still-present decorative layers.

- [ ] **Step 3: Convert page chrome and navigation**

Use `neu-flat` on `PageLayout`, `neu-raised` on the outer navigation and footer, `neu-inset` on the navigation control well, `neu-raised-sm` on neutral navigation buttons, and `neu-pressed` for active/pressed controls. Remove the NavBar top glow, bottom line, side ambience, inner edge glow, backdrop blur, and the BottomBar grid, gradients, lines, and shimmer markup.

Use these exact primitive hooks on the existing elements:

```tsx
<div className="neu-flat relative isolate flex min-h-screen flex-col transition-colors duration-300" />
<nav className="neu-raised fixed inset-x-0 top-0 z-50 overflow-visible pt-[env(safe-area-inset-top)]" />
<div data-testid="nav-panel" className="neu-inset relative flex shrink-0 items-center" />
<button className="neu-raised-sm nav-btn inline-flex items-center justify-center" />
<footer data-testid="bottom-bar" className="neu-raised relative flex-shrink-0 overflow-hidden" />
```

- [ ] **Step 4: Convert shared controls and dialogs**

Use `neu-inset` for form controls, `neu-raised-sm` for neutral buttons and popovers, `neu-pressed` on active states, and `neu-semantic-raised` for primary/danger buttons. Remove persistent border utilities from ordinary surfaces. Keep `focus-visible` outlines and semantic error colors.

- [ ] **Step 5: Convert login, register, and callback states**

Map auth canvas to `neu-flat`, auth cards and OAuth controls to `neu-raised`, fields and inline notices to `neu-inset`, and primary actions to `neu-semantic-raised`. Remove Shape Wave, aura, edge, blur, and glow layers from active auth markup and set their obsolete visual tokens to `none` or remove them when no source references remain.

- [ ] **Step 6: Run shared GREEN tests**

```bash
npm --prefix frontend run test -- PageLayout NavBar BottomBar AuthNeuromorphic AuthShapeWavePages FormFieldNeuromorphic BaseDialog Modal ConfirmDialog ThemeToggle ErrorMessage Spinner
npm --prefix frontend run lint
npm --prefix frontend exec -- tsc -b --pretty false
```

Expected: PASS with no behavior assertion changes.

- [ ] **Step 7: Commit the shared batch**

```bash
git add frontend/src/components/layout frontend/src/components/common frontend/src/components/auth frontend/src/styles/nav.css frontend/src/styles/platform.css frontend/src/styles/confirm-dialog.css
git commit -m "refactor: unify shared neuromorphic surfaces"
```

---

### Task 4: Migrate The Files Page And Collection Surfaces

**Files:**
- Modify: all File Workflow files listed in File Structure
- Test: existing Files, list, grid, filter, pagination, selection, and background-layer tests

- [ ] **Step 1: Write failing file-workflow visual contracts**

Add assertions that the files page canvas is `neu-flat`, toolbar/cards/menus/chips are `neu-raised` or `neu-raised-sm`, search/filter wells and selection wells are `neu-inset`, active chips and selected controls are `neu-pressed`, and file/folder content behavior remains unchanged.

Add negative source assertions:

```ts
for (const banned of [
  "fileListGlassScope",
  "filelist-tech-glow",
  "filelist-bar-glow",
  "background-image:var(--filelist",
]) {
  expect(filesSource).not.toContain(banned);
}
```

- [ ] **Step 2: Run the focused tests to verify RED**

```bash
npm --prefix frontend run test -- Files FileListContent FileListFilters FileListHeader FileListPagination FileListSelectionBar FileCardActionMenu FileListBackgroundLayer
```

Expected: FAIL on legacy glass hooks and missing primitive classes.

- [ ] **Step 3: Remove decorative file-page background layers**

Make `FileListBackgroundLayer` return `null` in both themes, then remove inactive Shape Wave, fireworks, canvas wash, vignette, beam, and glass-layer imports and markup from `Files.tsx` and `FileList.tsx`. Keep real thumbnails and preview media unchanged.

- [ ] **Step 4: Convert list, grid, filters, and selection surfaces**

Replace the file-list glass wrappers and CSS surface recipes with primitive hooks. Keep spacing, virtualization, drag/drop, grouping, pagination, and optimistic state logic untouched. Remove hard-coded visible border utilities from ordinary cards and menus; retain selection/focus indicators only when they communicate interaction state.

- [ ] **Step 5: Run file-workflow GREEN tests**

```bash
npm --prefix frontend run test -- Files FileListContent FileListFilters FileListHeader FileListPagination FileListSelectionBar FileCard FolderCard FileCardActionMenu GroupSelectCheckbox MixedGrid VirtualizedGrid
npm --prefix frontend run check:fluid-sizing
npm --prefix frontend exec -- tsc -b --pretty false
```

Expected: PASS; drag/drop, grouping, thumbnails, pagination, and filters retain existing behavior.

- [ ] **Step 6: Commit the file collection batch**

```bash
git add frontend/src/pages/Files.tsx frontend/src/components/files/list frontend/src/components/files/grid frontend/src/components/files/FolderBreadcrumb.tsx
git commit -m "refactor: clean file collection neuromorphic surfaces"
```

---

### Task 5: Migrate Uploads, File Dialogs, And Preview

**Files:**
- Modify: all Dialog, Upload, And Preview files listed in File Structure
- Test: existing dialog, upload, and preview tests

- [ ] **Step 1: Write failing upload/dialog/preview contracts**

Assert dialog shells and floating toolbars use `neu-raised`, content wells/dropzones/progress tracks/preview stages use `neu-inset`, neutral controls use `neu-raised-sm`, pressed controls use `neu-pressed`, and semantic actions use `neu-semantic-raised`.

Add negative assertions for active `confirm-dialog-tech-*`, grid, scanline, top-line, vignette, HUD, glass blur, and pseudo-element border layers.

- [ ] **Step 2: Run focused tests to verify RED**

```bash
npm --prefix frontend run test -- UploadDialog UploadFileItem UploadProgressList UrlUploadForm BatchShareDialog FileActivityDialog ManageTagsDialog ShareDialog VersionHistoryDialog FilePreview FilePreviewStage FilePreviewToolbar MobilePdfPreview
```

Expected: FAIL on old surface hooks and missing primitives.

- [ ] **Step 3: Convert upload and dialog surfaces**

Keep upload validation, queues, cancellation, progress, URL submission, and dialog callbacks unchanged. Remove tech grids, decorative top lines, pseudo-element frames, glass backgrounds, and duplicate page shadows. Apply primitives directly in JSX and leave CSS files responsible only for layout, sizing, animation, and semantic color.

- [ ] **Step 4: Convert preview surfaces**

Keep media rendering, pan/zoom, navigation, keyboard behavior, PDF sizing, code highlighting, and metadata unchanged. Apply `neu-inset` to the preview stage and metadata rail, `neu-raised` to information cards and floating toolbars, and `neu-raised-sm`/`neu-pressed` to controls. Remove static grid, vignette, scanline, HUD, and glass markup.

- [ ] **Step 5: Run dialog/upload/preview GREEN tests**

```bash
npm --prefix frontend run test -- UploadDialog UploadFileItem UploadProgressList UrlUploadForm BatchShareDialog FileActivityDialog ManageTagsDialog ShareDialog VersionHistoryDialog FilePreview FilePreviewContent FilePreviewStage FilePreviewTextPanel FilePreviewToolbar ImagePreview MarkdownCodeBlock MobilePdfPreview
npm --prefix frontend run lint
npm --prefix frontend exec -- tsc -b --pretty false
```

Expected: PASS.

- [ ] **Step 6: Commit the media workflow batch**

```bash
git add frontend/src/components/files/upload frontend/src/components/files/dialogs frontend/src/components/files/preview frontend/src/styles/confirm-dialog.css frontend/src/styles/preview.css
git commit -m "refactor: unify dialog upload and preview depth"
```

---

### Task 6: Migrate Settings, Share, Activity, Trash, And File Request

**Files:**
- Modify: all Business Page files listed in File Structure
- Modify: `frontend/src/styles/base.css`
- Modify: `frontend/src/styles/trashThemeTokens.test.ts`
- Test: existing Settings, Share, Shares, Activity, Trash, and FileRequest tests

- [ ] **Step 1: Write failing business-page contracts**

For each page, assert the outer canvas is `neu-flat`; top-level cards, summary tiles, list cards, and action groups use `neu-raised`; fields, list wells, metadata boxes, and filter rails use `neu-inset`; pressed/selected states use `neu-pressed`; semantic actions and badges use pure fills plus `neu-semantic-raised`.

Replace Trash tests that require `--trash-tech-*` with assertions that those tokens do not exist. Replace Activity and Shares tests that require `--share-center-neu-*`, `--codepen-neu-*`, or page-specific depth aliases with global primitive assertions.

- [ ] **Step 2: Run focused tests to verify RED**

```bash
npm --prefix frontend run test -- SettingsPageRegression ShareNeuromorphic Shares Activity Trash FileRequest trashThemeTokens
```

Expected: FAIL because current pages and `base.css` still contain page-specific surface systems.

- [ ] **Step 3: Convert Settings and shared settings helpers**

Change `settingsPanelClass` to `neu-inset`, `SettingsCard` and KPI surfaces to `neu-raised`, inputs to `neu-inset`, neutral actions to `neu-raised-sm`, selected theme controls to `neu-pressed`, and primary actions to pure semantic fills with `neu-semantic-raised`. Remove page-specific background, border, and shadow utilities from callers.

- [ ] **Step 4: Convert public Share and Share Center**

Use the same primitives for public Share cards, Shares page action tiles, inbox lists, request review panels, fields, rows, and buttons. Remove `--share-center-neu-*`, `--codepen-neu-*`, `share-center-action-tile-*` depth recipes, and any CSS selector that duplicates the primitive system. Preserve request approval/rejection, copying, filtering, and pagination.

- [ ] **Step 5: Convert Audit Center**

Preserve the current ten-visible pagination, five-card viewport behavior, auto-height card content, filter semantics, and file/folder/request metadata layout. Apply `neu-raised` to timeline and event cards, `neu-inset` to the filter rail and metadata container, `neu-semantic-raised` to badges/actions, and remove Activity/Settings/Share depth aliases. Keep semantic badge fills pure and borderless.

- [ ] **Step 6: Convert Trash and File Request**

Remove Trash grids, beams, scanlines, corner decoration, and `--trash-tech-*` tokens. Convert Trash cards/actions and public File Request form, upload well, review states, and status surfaces to the global primitives. Preserve restore/delete, countdown, request upload, validation, and close behavior.

- [ ] **Step 7: Delete duplicate page surface blocks from `base.css`**

Keep page-specific typography, spacing, and semantic colors only. Remove Share/Activity/Settings surface rules whose only purpose is to redefine background, border, or box-shadow already supplied by a primitive.

- [ ] **Step 8: Run business-page GREEN tests**

```bash
npm --prefix frontend run test -- SettingsPageRegression ShareNeuromorphic Shares Activity Trash FileRequest trashThemeTokens
npm --prefix frontend run lint
npm --prefix frontend exec -- tsc -b --pretty false
npm --prefix frontend run check:fluid-sizing
```

Expected: PASS with existing workflow assertions unchanged.

- [ ] **Step 9: Commit the business-page batch**

```bash
git add frontend/src/pages frontend/src/components/settings frontend/src/styles/base.css frontend/src/styles/trashThemeTokens.test.ts
git commit -m "refactor: finish project-wide neuromorphic migration"
```

---

### Task 7: Add Permanent Residue Guards And Full CI

**Files:**
- Create: `frontend/src/styles/neuromorphicResidueAudit.test.ts`
- Create: `frontend/scripts/check-neuromorphic-surfaces.mjs`
- Modify: `frontend/package.json`
- Modify: `frontend/src/styles/removedThemeCssResidue.test.ts`
- Create: `docs/constraints/C-310-neuromorphic-surfaces-use-one-global-primitive-system.md`

- [ ] **Step 1: Write the failing residue test**

Scan active `.css`, `.ts`, and `.tsx` files under `frontend/src`, excluding tests and generated output. Fail with file-relative diagnostics when source contains any of:

```ts
const banned = [
  /--share-center-neu-(?:raised|inset|pressed)/,
  /--codepen-neu-(?:bg|border)/,
  /--activity-neu-(?:raised|inset|pressed)/,
  /--trash-tech-/,
  /confirm-dialog-tech-(?:grid|topline)/,
  /preview-static-(?:grid|vignette|scanlines|hud)/,
  /filelist-tech-glow/,
];
```

Also parse the primitive rule bodies and fail if a primitive surface contains a gradient, image URL, non-transparent border, or an unapproved box-shadow alias.

- [ ] **Step 2: Run the residue test to verify RED**

```bash
npm --prefix frontend run test -- neuromorphicResidueAudit
```

Expected: FAIL with any residual source location missed by Tasks 3-6.

- [ ] **Step 3: Remove every reported active residue**

Delete obsolete tokens, selectors, pseudo-elements, and markup one report at a time. Do not add allow-list entries for active visual surfaces. The only allowed exclusions are test fixtures, real media/image preview content, syntax highlighting, and accessibility focus outlines.

- [ ] **Step 4: Add the CI command**

Add to `frontend/package.json`:

```json
"check:neuromorphic": "node scripts/check-neuromorphic-surfaces.mjs"
```

The script must print `OK: all active Neuromorphic surfaces use global primitives.` on success and exit nonzero with file/line diagnostics on failure.

- [ ] **Step 5: Document the permanent constraint**

Write C-310 with these immutable rules: ordinary surfaces use one primitive system; no visible persistent border; no surface gradients or glass; upper-left light source; semantic fills do not define a second depth system; focus-visible outlines remain allowed.

- [ ] **Step 6: Run full CI and focused coverage**

```bash
npm --prefix frontend run check:neuromorphic
npm --prefix frontend run check:tokens:strict
npm --prefix frontend run test
npm --prefix frontend run test:coverage
npm --prefix frontend run lint
npm --prefix frontend exec -- tsc -b --pretty false
npm --prefix frontend run check:fluid-sizing
npm --prefix frontend run build
```

Expected: all commands PASS; the full frontend coverage report is at least 90% for statements, branches, functions, and lines. Existing Vite chunk-size warnings may remain if unchanged.

- [ ] **Step 7: Commit the guard batch**

```bash
git add frontend/src/styles/neuromorphicResidueAudit.test.ts frontend/src/styles/removedThemeCssResidue.test.ts frontend/scripts/check-neuromorphic-surfaces.mjs frontend/package.json docs/constraints/C-310-neuromorphic-surfaces-use-one-global-primitive-system.md
git commit -m "test: prevent neuromorphic surface residue"
```

---

### Task 8: Rendered QA, Evidence, Quality Score, And PR

**Files:**
- Create: `docs/evidence/2026-06-18-project-wide-neuromorphic/manifest.md`
- Create: `docs/evidence/2026-06-18-project-wide-neuromorphic/judge.md`
- Create: screenshots under `docs/evidence/2026-06-18-project-wide-neuromorphic/after/`
- Create: `docs/evidence/2026-06-18-project-wide-neuromorphic/before-after.mp4`
- Modify: `docs/quality-score.md`

- [ ] **Step 1: Capture the complete route matrix**

Use Chrome on the running app. Capture light and dark at `1440x1000` and `390x844` for `/login`, `/files`, `/settings`, `/activity`, `/shares`, `/trash`, one `/share/:token`, and one `/request/:token`. Capture the GitHub callback loading state separately. For authenticated routes, reuse the existing local authenticated browser session; do not put credentials or tokens in docs.

Expected: 32 after screenshots plus callback evidence.

- [ ] **Step 2: Inspect interaction and content states**

For each applicable component family, inspect default, hover, active, focus-visible, selected, disabled, loading, empty, error, and populated states. Verify computed ordinary-surface borders are transparent/zero, backgrounds are the theme surface color, `background-image` is `none`, and shadows point down-right/up-left consistently.

- [ ] **Step 3: Check runtime health**

Read browser console logs for every route family. Expected: no framework overlay and no new error or warning associated with the migration. Verify no text, menu, dialog, card metadata, or mobile control is clipped or overlapped.

- [ ] **Step 4: Generate before/after video**

Use the corresponding before and after screenshots to create a labeled crossfade/contact-sheet MP4 with `ffmpeg`, saved as `before-after.mp4`. The video must include at least Files, Settings, Activity, Shares, Trash, Login, public Share, and File Request in both themes.

- [ ] **Step 5: Score the visual result**

Score 20 points each for primitive consistency, CodePen fidelity, residue removal, responsive integrity, and interaction/accessibility integrity. Record evidence-backed deductions in `judge.md`. Expected: total at least 95/100; below 95 returns to the responsible task before completion.

- [ ] **Step 6: Update project quality memory**

Append the final score, command results, evidence paths, residual risks, and commit IDs to `docs/quality-score.md` and complete `manifest.md`.

- [ ] **Step 7: Run final verification from a clean command state**

```bash
npm --prefix frontend run check:neuromorphic
npm --prefix frontend run check:tokens:strict
npm --prefix frontend run test
npm --prefix frontend run lint
npm --prefix frontend exec -- tsc -b --pretty false
npm --prefix frontend run check:fluid-sizing
npm --prefix frontend run build
git diff --check
git status --short
```

Expected: all verification commands PASS and `git status --short` contains only final evidence/docs changes before the last documentation commit.

- [ ] **Step 8: Commit evidence and request review**

```bash
git add docs/evidence/2026-06-18-project-wide-neuromorphic docs/quality-score.md
git commit -m "docs: record project-wide neuromorphic evidence"
```

Review the complete diff, confirm each commit remains scoped, push `codex/project-wide-codepen-neuromorphic`, open the final PR, and request review only after the score is at least 95.

---

## Assumptions

- The CodePen graphite/cloud screenshots supplied by the user are the visual authority when the remote Pen cannot be inspected programmatically.
- Existing local authenticated state and fixture data are available for protected and dynamic route evidence.
- Primary and semantic action colors remain meaningful, but their fills are pure colors and their shadows use the global light direction.
- Existing behavior tests are authoritative; visual changes may update style assertions but may not weaken workflow assertions.

## Risks And Mitigations

- **Dirty worktree:** isolate execution and synchronize only in-scope frontend files; never stage unrelated changes.
- **Large CSS blast radius:** land primitives first, then migrate one page family per commit with focused tests.
- **Legacy token aliases hide residue:** the static scanner rejects active duplicate depth systems instead of allowing compatibility aliases.
- **Light-theme low contrast:** verify text contrast and focus visibility on the exact `#e0e5ec` material before accepting screenshots.
- **Mobile clipping:** include `390x844` verification and existing fluid-sizing checks in every page-family batch.
- **Dynamic route availability:** use current local share/request records without recording token values in evidence.
- **PR size:** keep each functional batch independently reviewable; if a batch exceeds 300 changed lines, split it by component family without mixing behavior changes.

## Dependencies

- Approved design: `docs/superpowers/specs/2026-06-18-project-wide-codepen-neuromorphic-design.md`
- Chrome access to the reference Pen and local application
- Running frontend and backend for authenticated/dynamic visual evidence
- `ffmpeg` for the comparison video
- Existing Vitest, ESLint, TypeScript, token, and fluid-sizing tooling
