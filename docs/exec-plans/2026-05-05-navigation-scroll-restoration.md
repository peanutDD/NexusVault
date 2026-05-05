# Navigation Scroll Restoration Exec Plan

Settings entry must not inherit the previous route's scroll. Settings Back returns
to the previous history entry. File-list folder navigation and refresh restore
the last browsing position when one exists.

- Route scroll is history-entry scoped; file-list scroll is folder/sort/MIME/search scoped.
- New routes or scopes without saved state start at top.
- File-list-only restoration cannot fix Settings inheriting a bottom scroll.
- Touch only Settings, file-list navigation, route restoration, tests, and docs.

Plan: add failing regressions; change Settings Back to `navigate(-1)`; add
route-level scroll restoration keyed by React Router history entry; keep
file-list scoped restoration for folders and refresh; run focused tests, lint,
full test, and build.
