# Trash Soft Delete

## Goal

Files should be recoverable after normal deletion. A user delete moves the file
record into a trash view for 30 days. Only an explicit permanent delete, empty
trash action, or expired cleanup removes the database row and storage object.

## Scope

This first version covers files only. Folder deletion remains the existing
physical cascade behavior and should be handled in a separate PR.

## Design

- `files.deleted_at` is `NULL` for active files and set for trashed files.
- Normal file reads, lists, rename, move, batch metadata, downloads, previews,
  ZIP downloads, sharing checks, categories, and semantic search ignore trashed
  files by requiring `deleted_at IS NULL`.
- Trash APIs expose only deleted files for the authenticated user:
  `GET /api/files/trash`, `POST /api/files/{id}/restore`,
  `DELETE /api/files/{id}/permanent`, and `DELETE /api/files/trash`.
- Active filename uniqueness is enforced with a partial unique index scoped to
  `deleted_at IS NULL`, so a user may re-upload a same-name file after deletion.
  Restore fails with a validation error when an active same-name file already
  exists in the original folder.
- `trash_cleanup` is a background task type. The worker enqueues one task per
  UTC day with a date-based dedupe key and purges files older than 30 days.

## Operational Notes

Trashed files still count toward storage usage until hard deletion. Physical
storage deletion keeps the existing `file_path` reference-count guard so instant
upload/shared-path records cannot lose their backing object.
