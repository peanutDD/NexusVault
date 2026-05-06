# Refresh Scroll Restoration Exec Plan

Assumptions: browser refresh may recreate React Router history entries with a
new `location.key`; `/files` remains owned by file-list scoped restoration; the
active scroll must be saved before refresh starts.

Risks: URL fallback must not make newly pushed settings routes inherit old scroll
from unrelated visits. File-list refresh saving must not overwrite the
synchronously saved folder position used when leaving for Settings.

Dependencies: `ScrollRestoration`, `useFileList`, navigation scroll tests, and
C-036.

Plan: add failing regressions for route refresh with a changed history key and
file-list `beforeunload` saving; add URL-scoped route fallback plus refresh
event saving; add file-list `beforeunload` saving; run focused tests, lint, full
test, and build.
