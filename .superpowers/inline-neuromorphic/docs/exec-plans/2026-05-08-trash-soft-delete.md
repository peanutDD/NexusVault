# Trash Soft Delete Exec Plan

## Summary

Implement file-only trash support with soft delete, restore, permanent delete,
empty trash, and 30-day cleanup through the existing background task queue.

## Implementation

- Add `files.deleted_at`, an indexed trash query path, and an active-only unique
  filename index.
- Extend file entities/DTOs and repository traits with explicit soft-delete,
  trash list, restore, hard-delete, and expired-purge operations.
- Change normal delete and batch delete to set `deleted_at` instead of removing
  rows or storage objects.
- Add trash handlers/routes and worker support for `trash_cleanup`.
- Add frontend `fileTrashService`, `/trash` route/page, nav entry, and query
  invalidation across files/trash views.

## Tests

- Backend service tests cover soft delete visibility, batch soft delete, restore,
  restore conflict, permanent delete, empty trash, and expired cleanup.
- Frontend tests cover the facade contract and trash page restore/empty/empty-state
  behavior.
- Verification targets: backend fmt/clippy/tests and frontend lint/typecheck/test/build.

## Assumptions

- Folder trash is out of scope for this PR.
- Trashed files continue to count toward quota until hard deletion.
- Restore fails on active same-name conflict rather than auto-renaming.
