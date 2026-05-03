# C-021: Card titles are single-line ellipsis

Status: active

File and folder cards must render titles as one line with ellipsis overflow.
Do not use multi-line clamps for card titles. Keep virtualized card height
measurement aligned with this rule by using a single title line.

Folder card titles may be centered, but must keep symmetric inline padding so
the action menu does not overlap long names.

Reason: mixed card types should keep a consistent title rhythm and stable card
height. Long names must not wrap and change the visual density of the grid.
