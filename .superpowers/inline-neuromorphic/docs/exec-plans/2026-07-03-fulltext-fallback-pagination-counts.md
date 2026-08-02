# Fulltext Fallback Pagination And Counts

Date: 2026-07-03

## Goal

Fix root search result inconsistencies where single-character fulltext fallback displayed only the first default page while smart collection chips showed totals from the full filtered result set.

## Out Of Scope

- UI layout, color, theme, or chip visual changes.
- Changing existing page size or making the Files page load every match at once.
- Upload, preview, trash, sharing, or folder mutation behavior.

## Findings

- `fileListService.listFiles()` sent fulltext query, limit, folder scope, MIME, tag, and collection, but dropped `page`, `sort_by`, and `sort_order`.
- Backend single-character and digit fallback called `list_files()` with `page=1`, ignored the requested sort, and set API `count` from the current returned page length.
- Collection chips used collection-count queries over the full filtered set, so chip counts could be correct while the base search list only rendered the first backend page.

## Changed Modules

- `frontend/src/services/fileListService.ts`
- `frontend/src/services/fileListService.test.ts`
- `frontend/src/components/files/useFileList.ts`
- `frontend/src/components/files/useFileList.test.tsx`
- `backend/src/handlers/files/fulltext_search.rs`
- `backend/tests/fulltext_search_tests.rs`
- `docs/constraints/C-324-fulltext-fallback-pagination-total.md`
- `docs/quality-score.md`

## Test Strategy

- RED/GREEN frontend service regression proving fulltext requests forward `page`, `sort_by`, and `sort_order`.
- RED/GREEN frontend hook regression proving total pages use the shared 30-item page size.
- RED/GREEN backend fallback regression proving `count` is the full filtered total while `files` is only the requested page.
- RED/GREEN backend collection fallback regression proving collection totals match the filtered collection even when the page is smaller than the total.

## Verification

- `npm test -- fileListService.test.ts -t "preserves pagination"`
- `npm test -- useFileList.test.tsx -t "derives total pages"`
- `cargo test fulltext_filename_fallback_reports_total_and_honors_page_and_sort`
- `cargo test fulltext_filename_fallback_collection_counts_match_filtered_total`
- `npm test -- fileListService.test.ts useFileList.test.tsx`
- `cargo test --test fulltext_search_tests`
- `cargo fmt --check`
- `npm run lint -- src/services/fileListService.ts src/services/fileListService.test.ts src/components/files/useFileList.ts src/components/files/useFileList.test.tsx`
- `npm run build`
- `cargo test`

## Observability Evidence

Unit and integration tests assert outgoing query parameters and backend JSON response totals directly. No rendered screenshot was captured because the fix is API/list data behavior and no authenticated seeded browser session was started for this task.

## Rollback

Revert the listed source, test, and documentation changes. The patch is limited to fulltext fallback query semantics and total reporting.
