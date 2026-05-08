# C-042: Mobile folder drag starts only after a long press

Date: 2026-05-07

## Rule

Mobile folder move gestures must start with a long press, not a short tap or a
normal scroll gesture.

## Why

Folder cards already use taps, menus, checkboxes, and scrollable lists. Starting
a move immediately on touch would cause accidental folder moves and make mobile
navigation unreliable.

## Required Pattern

- Use desktop HTML drag/drop for mouse-driven movement.
- Use pointer events for touch-driven movement.
- Start touch folder drag only after the long-press threshold.
- Cancel the pending drag if the pointer moves beyond the scroll threshold before
  the long press fires.
- Ignore drops where the source and target folder are the same.
- Treat an empty `data-folder-id` as the root-folder sentinel and normalize it to
  `null` before calling folder move services.
- Keep menus, buttons, and selection controls excluded from drag startup.
