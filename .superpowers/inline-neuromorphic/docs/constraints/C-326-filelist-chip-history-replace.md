# C-326: File-list chip filters must replace browser history

Status: active

Files page collection chips, tag chips, the all chip, and the reset chip are
filter-state controls. They must update `/files` query parameters with history
replacement, not a new history entry.

Rules:

- Collection chip changes must call `setSearchParams` with `{ replace: true }`.
- Tag chip changes must call `setSearchParams` with `{ replace: true }`.
- Resetting smart chip filters must call `setSearchParams` with
  `{ replace: true }`.
- Folder navigation, breadcrumb navigation, and top-level app navigation remain
  real navigation actions and must continue to create browser history entries
  unless a specific route-level fallback requires replacement.
- Browser Back/Forward on Files should traverse folders/routes, not each
  intermediate chip filter state.
- Regression coverage must enumerate the visible chip row, not only sample a
  representative collection/tag. The covered row is: `重置`, `全部`, `收藏`,
  `置顶`, `最近`, `未标记`, `文件 (100MB+)`, `重复`, `图片`, `PDF`, `视频`,
  and visible `标签：...` chips.

Required guards after changing this behavior:

- A hook-level regression test must prove every visible smart collection chip,
  every visible tag chip, and both reset/all chips replace history.
- A component-level regression test must prove each visible screenshot chip
  routes to the expected Files filter handler.
- A folder-navigation regression test must prove folder entry still pushes
  history.
- Run `npm --prefix frontend run test -- useFileList useFileListNavigation`.

Reason: chip filters are local browsing state. Pushing every chip click into
browser history makes the browser Back/Forward buttons step through transient
filter states instead of the user's real file-directory or app-route journey.
