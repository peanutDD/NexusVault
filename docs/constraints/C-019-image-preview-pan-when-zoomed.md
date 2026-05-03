# C-019 Image Preview Pan When Zoomed

Date: 2026-05-03

## Constraint

Any image preview UI that supports zooming above `1x` must also provide a pan path so the user can reach clipped parts of the zoomed image.

## Rules

- Pan must be enabled for mouse, touch, and pen through pointer events.
- Pan must be disabled or reset when zoom returns to `1x` or below.
- Reset actions must clear pan, zoom, and rotation together.
- Pointer drag state must clean up on both pointer up and pointer cancel.
- Regression tests must cover pan state changes and pointer event wiring.

## Reason

Zoom without pan makes the preview trap content outside the visible frame, so users cannot inspect the hidden edges of an enlarged image.
