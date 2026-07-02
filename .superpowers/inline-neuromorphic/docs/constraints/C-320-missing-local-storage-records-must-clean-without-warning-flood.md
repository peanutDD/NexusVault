# C-320: Local Storage Consistency Checks Must Preserve Data

## Rule

When local storage and database file rows disagree, automated maintenance must treat the mismatch as recoverable state:

- Maintenance consistency checks must not delete `files` rows when `StorageBackend::open_read_stream` returns `AppError::NotFound`, `AppError::File`, or `AppError::Storage`.
- Orphan storage scans must not directly hard-delete physical upload files just because a matching active `files` row is absent. When physical cleanup is allowed, the scanner must first move the file into macOS `~/.Trash`; if that move fails, it must preserve the original file.
- File listing may hide missing local records, but must not emit per-file `WARN` logs for expected missing local objects.
- Cleanup may emit one summary warning per cycle; per-row details belong at `DEBUG`.
- Destructive repair of database rows or physical uploads must be an explicit, operator-initiated action with a dry-run or backup path. For local orphan cleanup, macOS `~/.Trash` is the backup path.

## Why

On 2026-07-01, relative `STORAGE_PATH=./uploads` could resolve against the wrong current working directory. The consistency checker then misclassified valid database rows as missing-storage orphans and deleted the `files` rows; the orphan storage scanner could then treat real upload files as untracked storage and delete physical files. The UI showed folders only and an empty trash because `files` had been emptied while `folders` remained.

## Enforcement

Keep regression coverage in `backend/tests/maintenance_tests.rs` for preserving missing-storage database rows and moving untracked upload files into macOS Trash instead of direct deletion. Keep config coverage in `backend/src/config/mod.rs` proving relative local storage paths resolve against the backend manifest directory, not process cwd.
