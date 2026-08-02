# C-324: Fulltext Filename Fallback Must Preserve List Query Semantics

## Rule

The fulltext filename fallback path must preserve the same pagination, sorting, folder scope, MIME, tag, and smart collection semantics as the normal file-list query, and response totals must report the filtered result total, not the current page length.

## Why

On 2026-07-03, a root search for `r` showed 30 file results and only 2 visible video cards, while the Videos chip showed 7. Clicking the Videos chip then displayed all 7 matching videos. The single-character fulltext route bypassed the index and used filename fallback, but that fallback forced `page=1`, ignored sort parameters, and returned `count = files.len()`. The chip counts were computed from the full filtered set, so the list page, chip counts, and filtered chip result diverged.

## Required Guards

- Fulltext fallback tests must cover `page`, `limit`, `sort_by`, and `sort_order`.
- Fulltext fallback collection tests must assert `count` and `search.count` are the filtered total even when the returned page is smaller.
- Frontend fulltext service tests must assert pagination and sorting parameters are forwarded to `/files/search/fulltext`.
- Frontend list-view pagination must derive total pages from the shared page-size constant, not from a hard-coded divisor.
- New file-list or search count behavior must not use page length as the total unless the API contract explicitly names it as a page count.

## Implementation Notes

- The fallback delegates to `FileService::list_files` so it can reuse the canonical list semantics.
- `count` and `search.count` should use the list query total when the fallback path is active.
- Materialized index hits may still report current materialized length when no total is available; do not mix that behavior into the fallback path.
