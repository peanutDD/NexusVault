# C-323: File List Selection And Counts Must Use Visible Folder Scope

## Rule

The Files page must derive rendered totals, select-all targets, smart collection counts, and fulltext search folder filters from the same current-folder visible scope.

## Why

On 2026-07-03, a search inside folder `T` displayed 5 visible file cards and `total: 5 files`, but "select all current folder files" selected 6 items. The rendered list was using filtered files/folders while `useFileSelection` still received raw unfiltered folders, so a hidden folder was selected.

The same investigation found root collection chips showing account-wide counts because `folder_id: null` was omitted by frontend query serialization. Root scope must be explicit across endpoints that need to distinguish "root folder" from "all folders".

## Required Guards

- Select-all tests must include at least one folder hidden by the current search/filter and assert it is not selected.
- Collection-count tests must assert root queries send `folder_id=root` instead of omitting `folder_id`.
- Fulltext root-scope tests must cover `folder_id=root` and prove nested-folder matches are excluded.
- Folder-scoped fulltext tests must cover the case where global index hits exist but are removed by folder filtering, so the handler falls back instead of returning an empty current-folder result.
- New Files page count or selection code must not consume raw `files`/`folders` when the UI renders a filtered or collection-filtered subset.

## Implementation Notes

- Frontend root scope is encoded as `folder_id=root` for service requests.
- Backend fulltext search accepts `root`, `null`, or an empty string as an explicit root-folder filter.
- The fulltext index currently stores `path` as `/{filename}`. Do not treat it as a folder hierarchy unless the index schema and rebuild path are explicitly changed.
- Omitted `folder_id` continues to mean unscoped/all allowed folders only where the endpoint intentionally supports account-wide behavior.
