# C-316 FileList Group Mixed State Must Not Look Checked

Status: active

Files group-selection controls have three distinct states:

- `checked`: every item in the current group is selected.
- `mixed`: at least one, but not every, item in the current group is selected.
- `unchecked`: no item in the current group is selected.

The `mixed` state must never reuse checked/full-select fill tokens or selectors.
It may keep a neutral group-control treatment, but it must not look like the
category or folder group is fully selected.

This applies to type groups, time groups, pinned standalone groups, and folder
groups under every sort mode.

Required regression coverage after changing Files group-selection visuals:

- `npm --prefix frontend run test -- GroupSelectCheckbox`
- `npm --prefix frontend run test -- FileListContent FileListPrimitiveContract`
- `npm --prefix frontend run lint -- --quiet`
- `npm --prefix frontend run build`
