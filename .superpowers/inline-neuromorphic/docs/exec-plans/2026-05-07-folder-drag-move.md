# Folder Drag Move Exec Plan

Folders can be moved by dragging one folder onto another folder. On mobile,
folder dragging starts only after a long press to avoid stealing normal taps,
selection, menus, and scroll gestures.

## Intent

Add folder drag-to-move for desktop and mobile while reusing the existing folder
move APIs and preserving current file drag behavior.

## Assumptions

- A folder dropped on another folder should move into the target folder.
- Mobile drag uses a long press because native HTML drag/drop is unreliable on touch.
- Existing backend APIs already enforce ownership, cycles, and folder move validity.
- Dropping a folder onto itself is a no-op.

## Risks

- Short taps must not start a move or block menu/selection controls.
- Touch scrolling must cancel the pending long press before drag starts.
- Virtualized rows can unmount off-screen, so this PR only supports visible drop targets.
- Existing desktop drag/drop must keep working for files.

## Dependencies

- `frontend/src/components/files/grid/FolderCard.tsx`
- `frontend/src/components/files/grid/FolderGrid.tsx`
- `frontend/src/components/files/grid/MixedGrid.tsx`
- `frontend/src/components/files/grid/VirtualizedMixedGrid.tsx`
- `frontend/src/components/files/list/FileList.tsx`
- `frontend/src/components/files/useFileList.ts`
- `frontend/src/hooks/files/useFileActions.ts`
- `frontend/src/services/folders.ts`

## Steps

1. Add failing card tests for mobile long-press drag and short-tap no-op.
2. Add failing action tests for dropped file/folder movement and self-drop no-op.
3. Implement mobile long-press state in `FolderCard`.
4. Wire mobile folder drop callbacks through folder grid variants.
5. Add `handleDropOnFolder` to the file actions hook and reuse it for breadcrumb drops.
6. Replace the `FileList` no-op drop adapter with the real movement handler.
7. Add a permanent constraint for mobile folder drag semantics.
8. Run focused tests, related grid/list regressions, lint, full test, and build.
