# C-322: Orphan Cleanup Must Treat File Versions As Tracked

## Rule

Local orphan-storage maintenance must treat both `files.file_path` and `file_versions.file_path` as tracked storage objects.

## Why

Historical file versions are intentionally stored under snapshot UUID directories, so their directory UUID does not have to match an active `files.id`. Scanning only active file IDs misclassifies valid `_vN-*` version files as untracked storage and can move valid historical data out of uploads.

## Enforcement

- When auditing local upload storage, check exact storage paths against both `files` and `file_versions`.
- Skip macOS metadata files such as `.DS_Store` and `._*`.
- Per-file move diagnostics must be no louder than `debug`; routine cleanup should emit aggregate summaries at `info`.
- Regression coverage must include a `file_versions.file_path` whose directory UUID is not an active `files.id`.
