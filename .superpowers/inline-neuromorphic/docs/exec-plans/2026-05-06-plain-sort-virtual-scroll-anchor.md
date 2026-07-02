# Plain Sort Virtual Scroll Anchor Exec Plan

Assumptions: `type_group` and `time_group` use grouped non-virtual views, while
plain sorts use virtualized mixed/file grids. Browser scroll anchoring can choose
virtual rows as anchors while top/bottom spacer heights change.

Risks: disabling anchoring must be scoped to virtual list internals only. It must
not remove hover spacing or change sort behavior.

Dependencies: `VirtualizedFileGrid`, `VirtualizedMixedGrid`, `misc.css`, virtual
grid regression tests, and C-036.

Plan: add a failing regression requiring virtual grids to expose scroll-stability
classes; add scoped `overflow-anchor: none` to virtual containers, rows, and
spacers; run focused tests, lint, full test, and build.
