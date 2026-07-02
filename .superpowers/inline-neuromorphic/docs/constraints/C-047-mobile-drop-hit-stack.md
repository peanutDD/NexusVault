# C-047: Mobile Drop Target Detection Must Use The Pointer Hit Stack

Date: 2026-05-07

## Rule

Mobile drag release must inspect the pointer hit stack, not only
`document.elementFromPoint`.

## Why

During long-press drag, the dragged card can still be the topmost element at the
release point. If target detection only checks the top element, the folder under
the dragged card is missed and the move silently fails.

## Required Pattern

- Prefer `document.elementsFromPoint(x, y)` and scan for the first
  `[data-folder-id]` target.
- Fall back to `document.elementFromPoint` only when `elementsFromPoint` is not
  available.
- For folder drags, skip the source folder id while scanning so self-drops stay
  no-op.
