# C-020: Card hover spacing must preserve borders

Status: active

File and folder cards use a small `translateY(-1px)` hover lift. Any grid or
virtualized row that renders these cards must reserve at least `12px` vertical
spacing between rows, and virtualized height math must use the same row gap as
the rendered layout.

Plain-sort lists (`newest`, `oldest`, `name`, `size`) must also reserve top
padding before the first card row, because they do not render a group header
above the grid.

Virtualized rows use `content-visibility: auto`, which paint-contains each row.
They must put hover headroom inside the row, such as `pt-1`, not only in the
external row margin.

Reason: a tight row gap can visually clip or cover the hovered card's top
border when the card moves upward.
