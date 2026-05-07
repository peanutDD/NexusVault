# C-043: Dragging a selected item moves the full current selection

Date: 2026-05-07

## Rule

When drag-to-move starts from a selected file or folder, the move payload must
include all currently selected files and folders. When drag-to-move starts from
an unselected item, the payload must include only that item.

## Why

The batch move dialog already treats the current selection as the operation
scope. Drag-to-move must follow the same model so users can select mixed files
and folders once, then move the group directly.

## Required Pattern

- Expand the payload in the shared action layer so list, grid, mobile, and
  breadcrumb drops follow the same selection semantics.
- Keep unselected drags as single-item moves.
- When the target folder is part of the selected folder payload, exclude only
  that folder from `moveFolders`; do not block selected files or other folders
  from moving into the target.
- Use the shared `handleDropOnFolder` action path for desktop and mobile drops.
- Keep mobile drag gated behind the long-press rule from C-042.
- Include mobile drag callbacks in memo comparison when callbacks carry current
  selection state through parent closures.
