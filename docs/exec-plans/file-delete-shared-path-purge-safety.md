# Exec-Plan: File Delete Shared-Path Purge Safety

- Date: 2026-05-11
- Scope: `backend/src/services/file/delete.rs`, backend service tests
- Trigger: security scan reports that `purge_expired_trash` may delete a shared `file_path` while another active file record still references it.

## Goal

Prove and preserve the invariant that hard-deleting trash records never removes the underlying storage object while any remaining `files` row still references the same `file_path`.

## Non-Goals

- Do not change trash retention policy.
- Do not alter upload or instant-upload behavior.
- Do not delete or rewrite database migration history.

## Assumptions

- Shared `file_path` can exist through instant upload or storage dedupe.
- `files_repo.count_by_file_paths` counts remaining rows after the hard delete transaction returns deleted rows.
- Deleting derived assets by deleted file id is safe because derived assets are id-scoped, while the primary storage object is path-scoped.

## Risk

If future code reintroduces “subtract deleted rows from current counts” style logic, it could delete storage that is still referenced by active or non-expired records. A service-level regression test must fail in that case.

## Steps

1. Add a failing service test where an expired trashed file and an active file share the same `file_path`.
2. Verify `purge_expired_trash` removes only the expired DB row and leaves the storage object readable.
3. If needed, make cleanup path selection explicit in `delete.rs` so storage deletion is based only on remaining DB refs.
4. Run the targeted backend test, fmt, and clippy.
