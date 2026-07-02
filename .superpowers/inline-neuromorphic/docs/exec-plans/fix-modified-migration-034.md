# Exec-Plan: Restore Modified Migration 034

- Date: 2026-05-11
- Scope: `backend/migrations`, migration governance docs/tests if needed
- Problem: startup fails with `migration 34 was previously applied but has been modified`.

## Goal

Restore `backend/migrations/034_add_files_deleted_at.sql` to the exact content originally applied when the trash feature introduced it, then move later index semantics into a new migration `035_*`.

## Non-Goals

- Do not edit the local database `_sqlx_migrations` table.
- Do not drop user data.
- Do not rewrite or squash migration history.

## Assumptions

- Existing environments may already have applied the original 034 checksum.
- The later split unique-index semantics are still desired, but must be represented as a new migration.
- Backend uses SQLx migrations, which treats applied migration files as immutable.

## Risk

If an environment already applied the modified 034 file before this fix, it will have the opposite checksum mismatch. That environment must be treated as a bad transient branch state and reconciled manually; committed history should preserve the originally released migration.

## Steps

1. Restore migration 034 to the content from commit `1cdf7e1`.
2. Add migration 035 that drops/recreates the active filename indexes with the split root/folder behavior.
3. Add a permanent constraint forbidding edits to applied migrations.
4. Run backend migration-related tests or at minimum backend fmt/clippy/test target available locally.
