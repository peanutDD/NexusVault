# C-020: Card hover spacing must preserve borders

Status: active

File and folder cards use a small `translateY(-1px)` hover lift. Any grid or
virtualized row that renders these cards must reserve at least `12px` vertical
spacing between rows, and virtualized height math must use the same row gap as
the rendered layout.

Reason: a tight row gap can visually clip or cover the hovered card's top
border when the card moves upward.
