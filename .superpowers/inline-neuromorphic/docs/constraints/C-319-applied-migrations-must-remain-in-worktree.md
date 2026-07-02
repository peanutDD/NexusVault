# C-319 Applied Migrations Must Remain In Worktree

Any migration version that has reached a shared local or development database must remain present in the backend worktree with the exact applied checksum.

Requirements:
- Do not remove migration files after they have been applied anywhere outside a disposable test schema.
- If a worktree is copied or split, copy all applied migration files with their original bytes.
- Migration governance tests must assert the presence and SHA-384 checksum of applied migrations that are known to exist in the development database.
- Fix missing migration files by restoring the original SQL file, not by editing `_sqlx_migrations`, dropping schemas, or resetting databases.

This prevents startup failures such as `migration 39 was previously applied but is missing in the resolved migrations`.
