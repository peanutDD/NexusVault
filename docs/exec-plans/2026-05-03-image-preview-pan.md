# Image Preview Pan Exec Plan

Date: 2026-05-03

## Scope

- Add drag-to-pan behavior for image previews after zooming in.
- Keep the change limited to the file preview image path.
- Reset pan when zoom returns to `1`, when reset is clicked, and when the previewed file changes.
- Preserve existing zoom, rotate, close, download, and navigation behavior.

## Assumptions

- Pan is only useful when `zoom > 1`.
- Mouse, touch, and pen input should share pointer event handling.
- The image remains visually clipped by the preview frame, but the user can move the zoomed image inside that frame.
- Existing upload-related working tree changes are unrelated and must not be touched.

## Risks

- Transform ordering can make drag direction feel wrong after rotation.
- JSDOM cannot fully prove visual bounds, so logic tests need a browser smoke check.
- Pointer capture cleanup must handle cancel and leave cases to avoid a stuck dragging state.

## Verification

- `npm test -- useImagePan`
- `npm test -- ImagePreview`
- `npm test`
- `npm run lint`
- `npm run build`
- Browser smoke check: zoom an image to `2x`, drag to each side, and confirm hidden areas become visible.
