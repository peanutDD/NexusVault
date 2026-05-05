# Refresh Deep File-list Scroll Exec Plan

Assumptions: refreshing `/files` can recreate the page with only the first
infinite-query page loaded; saved scroll positions can point below the current
document height; browser `scrollTo` clamps when content is not tall enough.

Risks: restoration must not load forever, and it must not keep forcing scroll
after the saved position has been applied. New folders with no saved position
must still start at top.

Dependencies: `useFileList`, `useFiles` pagination state, file-list navigation
tests, C-036, and quality score history.

Plan: add a failing regression for a deep saved scroll with insufficient document
height and `hasMore`; load additional pages before applying that saved scroll;
retry restoration when list size changes; run focused tests, lint, full test,
and build.
