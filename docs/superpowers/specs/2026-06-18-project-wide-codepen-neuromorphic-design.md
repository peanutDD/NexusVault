# Project-Wide CodePen Neuromorphic Design

Date: 2026-06-18

## Goal

Apply the clean Neuromorphic visual language from
`https://codepen.io/oathanrex/full/azNQpPj` to every frontend route and shared
component in both light and dark themes. Remove residual borders, gradients,
glass layers, technical decoration, and page-specific shadow systems while
preserving all application behavior.

## Approved Direction

Use one global primitive system as the single source of truth. Pages and
components may map semantic roles to primitives, but they may not define a
second raised, inset, pressed, or flat surface system.

The approved visual rules are:

1. The light source is fixed at the upper left across the entire application.
2. Each theme uses one base surface color for ordinary Neuromorphic surfaces.
3. Depth comes only from paired light and dark shadows.
4. Ordinary Neuromorphic surfaces use transparent or zero-width borders.
5. Ordinary raised, inset, and pressed surfaces use no linear gradients,
   radial gradients, glass overlays, pseudo-element highlights, scanlines, or
   decorative glows.
6. Semantic colors are reserved for primary actions, statuses, warnings,
   errors, and success states. They do not alter the depth system.
7. Accessibility focus indicators remain visible and are the only deliberate
   outline exception around interactive surfaces.

## Theme Primitives

Both themes expose the same four semantic primitives:

- `flat`: page canvas and intentionally unframed content regions.
- `raised`: cards, menus, toolbars, buttons, dialogs, and floating controls.
- `inset`: inputs, textareas, selects, list wells, tracks, dropzones, and
  metadata rails.
- `pressed`: active navigation, selected options, toggled controls, and pressed
  button states.

The dark theme follows the CodePen graphite family. The light theme follows the
CodePen cloud family. The implementation will centralize the base colors,
paired shadows, radii, and density aliases in the existing token layer. Page
tokens such as Settings, Share Center, Audit Center, file list, preview, trash,
auth, and dialog tokens must resolve to these primitives instead of maintaining
independent surface definitions.

## Route Coverage

The migration covers every router entry in light and dark themes:

1. `/login`
2. `/register`
3. `/auth/callback/github`
4. `/share/:token`
5. `/request/:token`
6. `/files`
7. `/settings`
8. `/activity`
9. `/shares`
10. `/trash`

The wildcard redirect has no independent visual surface.

## Component Mapping

### Page Shells And Navigation

- Page canvases are `flat`.
- Navigation, desktop chrome, mobile bars, and floating navigation controls are
  `raised`.
- Current navigation items and pressed controls are `pressed`.
- Platform-specific wrappers reuse the same primitives and may not introduce a
  separate macOS or Tauri shadow direction.

### Cards, Lists, And Menus

- Content cards, list cards, context menus, dropdowns, and pagination shells
  are `raised`.
- List wells, metadata sections, empty slots, and recessed content regions are
  `inset`.
- Dividers remain structural separators only and may not imitate a visible
  frame around an otherwise Neuromorphic surface.

### Forms And Selection Controls

- Text inputs, textareas, selects, date controls, search fields, and editable
  fields are `inset`.
- Select and date popovers are `raised`.
- Focus styling preserves keyboard visibility without reintroducing the old
  persistent border treatment.
- Disabled controls retain readable contrast and use a primitive surface with
  muted content rather than a separate glass or gradient background.

### Buttons, Badges, And Statuses

- Neutral controls are `raised`; active and pressed controls are `pressed`.
- Semantic action buttons use a pure semantic fill with the same Neuromorphic
  shadow direction.
- Status badges use pure semantic fills and no surrounding frame treatment.
- Icon buttons keep stable dimensions and the same state transitions as text
  buttons.

### Dialogs, Upload, And Preview

- Dialog shells, drawers, popovers, upload panels, and floating preview
  toolbars are `raised`.
- Dialog content wells, upload dropzones, progress tracks, preview stages, and
  metadata rails are `inset` where depth communicates containment.
- Backdrops remain neutral and do not add glass texture or decorative grids.
- Loading, empty, error, and success states reuse the same primitives instead
  of falling back to legacy `tech`, `glass`, `scanline`, or glow treatments.

## Behavior And Data Flow

This is a visual-system migration only. It must not change:

- API contracts or service calls
- authentication and authorization behavior
- router paths or redirect behavior
- query caching, pagination, filtering, sorting, or refresh semantics
- upload, download, preview, share, request, trash, or settings workflows
- keyboard navigation, focus order, or accessibility labels
- responsive content ordering or information availability

Existing component state remains the source of truth. Visual states map to the
primitive layer without introducing new application state.

## Failure And Error Handling

Existing error boundaries, inline errors, alerts, loading states, empty states,
and retry controls keep their current behavior and copy. Their surfaces are
remapped to the global primitives, while semantic color continues to indicate
severity. A visual migration failure must be isolated to the current batch and
reverted without reverting unrelated worktree changes.

## Rollout

The project-wide target is implemented in five independently verifiable batches
so each change remains reviewable and reversible:

1. Global primitive tokens and permanent static residue tests.
2. Shared page shells, navigation, footer, common controls, feedback, and auth.
3. Files, file cards and lists, filters, uploads, previews, menus, and file
   dialogs.
4. Settings, Shares, public Share, Activity, Trash, and File Request pages,
   including all loading, empty, error, and populated states.
5. Full visual matrix verification, evidence capture, constraint docs, and
   quality scoring.

Each batch follows RED test, minimal implementation, GREEN test, browser
verification, and documentation. No batch may hide legacy residue with a broad
`!important` compatibility layer.

## Permanent Guards

Automated contract tests must reject:

- page-specific raised, inset, pressed, or flat shadow systems
- visible borders on ordinary Neuromorphic surfaces
- gradient or image backgrounds on ordinary primitive surfaces
- legacy `glass`, `tech`, `scanline`, glow, and duplicate CodePen or
  Share-specific surface aliases in active Neuromorphic render paths
- pseudo-elements that add decorative borders or highlights to primitive
  surfaces
- different light-source directions between component families or themes

Component tests must verify that shared controls and each route family map to
the intended primitive hooks without changing interaction behavior.

## Verification Matrix

Verification covers all ten routes at desktop and mobile widths in light and
dark themes. Dynamic routes use controlled fixtures or existing local data.
Each applicable page is checked in populated, loading, empty, and error states.
Interactive components are checked in default, hover, active, focus-visible,
selected, and disabled states.

Required commands include:

```bash
npm --prefix frontend run test
npm --prefix frontend run lint
npm --prefix frontend exec -- tsc -b --pretty false
npm --prefix frontend run check:fluid-sizing
npm --prefix frontend run build
```

Rendered verification must capture before/after screenshots and a comparison
video, check console errors and warnings, and record evidence in `docs/`. The
quality score must be at least 95 before the final PR is presented.

## Acceptance Criteria

1. Every visible route and shared component uses the global primitive system in
   both themes.
2. Ordinary Neuromorphic surfaces have no visible residual border, gradient,
   glass overlay, decorative glow, or conflicting page-specific shadow.
3. Raised, inset, and pressed states match the approved CodePen direction and
   remain visually consistent across desktop and mobile.
4. Existing behavior, data flow, accessibility, and responsive information are
   unchanged.
5. Static guards, component tests, lint, typecheck, fluid sizing, and build all
   pass.
6. The complete route/theme/viewport evidence matrix is recorded, the LLM
   visual judge score is at least 95, and `docs/quality-score.md` is updated.
