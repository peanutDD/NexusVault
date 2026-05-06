# Settings Return Folder Scroll Exec Plan

Assumptions: Settings is opened from the shared top navigation while the file
list is still visible. The browser may change `window.scrollY` during route
transition before file-list cleanup runs.

Risks: saving during cleanup can overwrite the real folder position with a
fixed route-transition value. The fix must not affect folder-to-folder saves.

Dependencies: `NavBar`, `useFileList`, file-list navigation tests, and C-036.

Plan: add a failing regression for file folder -> Settings -> Back restoring
the pre-Settings scroll; dispatch a narrow pre-route-change save event from the
Settings nav button; have `useFileList` save immediately and skip that unload
overwrite; run focused tests, lint, full test, and build.
