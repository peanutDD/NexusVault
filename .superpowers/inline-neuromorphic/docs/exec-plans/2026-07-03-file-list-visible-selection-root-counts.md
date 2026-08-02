# File List Visible Selection And Root Counts

Date: 2026-07-03

## Goal

Fix the Files page bugs where selecting all after a folder search selected hidden folders, and where smart collection chips in the root folder displayed account-wide counts instead of counts for the current folder.

## Out Of Scope

- Visual redesign of the Files toolbar, selection bar, or collection chips.
- Changes to upload, preview, trash, sharing, or folder mutation workflows.
- Repairing pre-existing visual skin contract failures in `FileListSelectionBar.test.tsx`.

## Findings

- `useFileList` passed raw `files` and `folders` into `useFileSelection`, while the UI rendered `finalDisplayFiles` and search-filtered folders. A hidden folder could therefore be included in "select all" even when the visible list and total count showed fewer items.
- `FileListSelectionBar` sent `folder_id: null` for root count queries. The frontend query builder omitted null values, so collection counts became account-wide.
- Root fulltext search had the same null omission issue. Sending `folder_id=root` previously failed because the backend fulltext query parsed `folder_id` only as a UUID.
- Adjacent fulltext risk: the search index path stores only `/{filename}`, not folder hierarchy. Folder-scoped fulltext results therefore need database folder filtering and a fallback when index hits are filtered away.

## Changed Modules

- `frontend/src/components/files/useFileList.ts`
- `frontend/src/components/files/useFileList.test.tsx`
- `frontend/src/components/files/list/FileListSelectionBar.tsx`
- `frontend/src/components/files/list/FileListSelectionBar.test.tsx`
- `frontend/src/services/fileListService.ts`
- `frontend/src/services/fileListService.test.ts`
- `backend/src/handlers/files/fulltext_search.rs`
- `backend/tests/fulltext_search_tests.rs`
- `docs/constraints/C-323-file-list-visible-scope.md`
- `docs/quality-score.md`

## Test Strategy

- RED/GREEN frontend hook regression for select-all using the exact filtered current-folder files and folders rendered by the list.
- RED/GREEN frontend selection bar regression for root folder collection-count queries using `folder_id=root`.
- RED/GREEN frontend service regression for root fulltext search preserving root scope.
- RED/GREEN backend API regression for `/files/search/fulltext?q=3&folder_id=root` returning only root files.
- Backend regression for folder-scoped long fulltext search falling back to current-folder filename search when global index hits are filtered away by folder scope.

## Verification

- `npm test -- fileListService.test.ts useFileList.test.tsx`
- `npm test -- FileListSelectionBar.test.tsx -t "loads counts"`
- `npm test -- FileListSelectionBar.test.tsx` still has 4 pre-existing visual skin assertion failures unrelated to count scope; both count-scope tests pass.
- `npm run lint -- src/components/files/useFileList.ts src/components/files/useFileList.test.tsx src/components/files/list/FileListSelectionBar.tsx src/components/files/list/FileListSelectionBar.test.tsx src/services/fileListService.ts src/services/fileListService.test.ts`
- `npm run build`
- `cargo fmt --check`
- `cargo test fulltext_api_scopes_root_folder_searches_to_root_files`
- `cargo test fulltext_api_falls_back_when_folder_filtered_index_hits_are_empty`
- `cargo test fulltext_api_uses_filename_fallback_for_single_character_queries`
- `cargo test`

## Observability Evidence

Unit and integration tests assert the API query parameters and backend response contents directly. No rendered screenshot was captured because this fix is data-scope behavior rather than visual layout, and the local authenticated seeded Files screen was not started for this task.

## Rollback

Revert the listed source, test, and documentation changes. The patch is limited to folder-scope query semantics and selection input wiring.
