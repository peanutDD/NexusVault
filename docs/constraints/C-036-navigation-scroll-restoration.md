# C-036: Route and file-list navigation must preserve browsing position

Route navigation must persist scroll by history entry. File-list navigation must also persist by folder, sort, MIME filter, and search text.
Rules:

- Settings Back must use browser history instead of hardcoding `/files`.
- Settings must not render Quick nav or same-page hash navigation.
- A newly pushed route with no saved position starts at top.
- Browser Back/Forward and refresh restore saved route position.
- Route refresh must have a URL-scoped fallback because the browser/router may
  recreate the history entry key after reload; pushed routes must still start at
  top when they have no entry-specific position.
- Scroll restoration MUST cover every authenticated route, including `/files`.
  Path-based exclusions (e.g. `if (pathname === "/files") return null`) are
  forbidden — they regress browser-refresh behavior on the primary file
  browser. Routes with async-rendered content rely on the height-aware retry
  loop below to land at the saved position.
- Restoration to a non-zero target MUST retry across animation frames until the
  document height is large enough to reach the target (or a frame budget is
  exhausted), and MUST abort immediately on user `wheel` / `touchmove` /
  `keydown` so it never fights manual scrolling.
- Folder navigation restores saved file-list scope; no saved scope starts at top.
- Settings navigation must synchronously save active file-list scroll before route change.
- Virtualized file-list containers must opt out of browser scroll anchoring.
- File-list refresh restoration must not mark a saved position as applied while
  the document is still too short to reach it; if `hasMore` is true, load more
  pages and retry when list size changes.
- Persist positions during scroll and before beforeunload/pagehide/visibility
  cleanup; add regression tests before changing this behavior.

Reason: hardcoded returns and unconditional top-scrolls drop folder context and make users lose their place after Settings, folder entry, Back, or refresh.
