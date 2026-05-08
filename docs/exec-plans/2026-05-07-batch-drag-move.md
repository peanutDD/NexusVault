# Batch Drag Move Exec Plan

When files and folders are selected together, dragging any selected item onto a
folder moves the whole current selection. Dragging an unselected item keeps the
existing single-item move behavior. Mobile file and folder moves start with a
long press.

## Intent

Make drag-to-move match the existing batch move dialog semantics while keeping
the fast direct manipulation workflow on desktop and mobile.

## Assumptions

- A selected dragged file represents all selected files and folders.
- A selected dragged folder represents all selected files and folders.
- An unselected dragged item represents only itself.
- The existing folder move service remains the single execution path.

## Risks

- File card memoization can hold stale callbacks if selection changes without
  changing the dragged file card's own selected state.
- Mobile file long press must not trigger preview after the move completes.
- Batch payload expansion must not affect unselected single-item moves.
- Dropping selected folders onto themselves must remain filtered by the action layer.

## Dependencies

- `frontend/src/components/files/list/FileList.tsx`
- `frontend/src/components/files/grid/FileCard.tsx`
- `frontend/src/components/files/grid/FileGrid.tsx`
- `frontend/src/components/files/grid/VirtualizedFileGrid.tsx`
- `frontend/src/components/files/grid/MixedGrid.tsx`
- `frontend/src/components/files/grid/VirtualizedMixedGrid.tsx`
- `frontend/src/components/files/list/FileListVirtualScroller.tsx`
- `frontend/src/components/files/list/FileListGroupedView.tsx`

## Steps

1. Add failing tests for selected file, selected folder, and unselected file drag payloads.
2. Add failing test for mobile file long-press drop onto a target folder.
3. Expand `FileList` drop adapter payloads when the dragged source is selected.
4. Add mobile long-press drag/drop to `FileCard`.
5. Wire mobile file drops through plain, grouped, mixed, and virtualized grids.
6. Include mobile drag callbacks in `FileCard` memo comparison to prevent stale selection closures.
7. Add permanent constraint and quality score entry.
8. Run focused tests, related regressions, lint, full test, and build.
