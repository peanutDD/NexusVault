# C-063: Trash purge must preserve shared storage paths

## Rule

Hard-deleting trash rows must only delete the underlying storage object when no remaining `files` row references the same `file_path`.

Cleanup code must not subtract the just-deleted rows from a reference count that was already queried after deletion.

## Why

Instant upload and dedupe can make multiple file records share one storage path. If trash purge deletes the storage object while another active file still references that path, the app causes cross-file data loss.

## Enforcement

`backend/tests/service_file_tests.rs::test_file_service_purge_expired_trash_keeps_storage_when_active_file_shares_path` creates an expired trashed row and an active row sharing one `file_path`, purges trash, and asserts the storage object remains.
