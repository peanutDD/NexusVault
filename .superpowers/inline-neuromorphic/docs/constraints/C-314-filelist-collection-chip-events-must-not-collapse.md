# C-314 FileList Collection Chip Events Must Not Collapse

Status: active

Files collection and tag chips must never trigger the collection rail collapse
toggle unless the user explicitly activates the `更多筛选` / `收起筛选` button.

Chip interactions must stop propagation for the full pointer/mouse click
gesture, not only `pointerdown` and `click`. At minimum, visible collection and
tag chip buttons must guard `pointerdown`, `pointerup`, `mousedown`, `mouseup`,
and `click` so parent collapse boundaries, outside-click handlers, or gesture
listeners cannot interpret a chip tap as a request to collapse the rail.

This applies when the event target is the button itself and when the event
target is a child label/count/dot inside the button. Hidden measurement chips
must remain inert with `aria-hidden` and `tabIndex=-1`.

Required regression coverage after changing Files collection chips:

- `npm --prefix frontend run test -- FileListSelectionBar`
- `npm --prefix frontend run test -- FileListContent FileListPrimitiveContract fileListFilterParams`
- `npm --prefix frontend run lint -- --quiet`
- `npm --prefix frontend run build`
