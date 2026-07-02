# 2026-07-01 Backend Migration History Restore

## Intent

Let `.superpowers/inline-neuromorphic/backend` start against the default local `file_storage` database without an isolated schema workaround.

## Assumptions

- The default local database is shared development state and must not be reset.
- The backend worktree should contain every migration already recorded in `_sqlx_migrations`.
- Missing migration files can be restored from the main repository copy only if their SHA-384 checksums match the database records.

## Risks

- Restoring mismatched migration bytes would trigger checksum mismatch instead of missing-file errors.
- Resetting or editing the database would destroy or corrupt local development state.
- Historical file rows may reference missing local storage objects; that can produce maintenance warnings without blocking startup.

## Plan

1. Query `_sqlx_migrations` for applied versions and checksums.
2. Compare missing migration files from the main repository copy with the database checksums.
3. Add RED migration governance coverage for versions 039-047.
4. Restore the exact migration SQL files and verify the governance test.
5. Start the backend against the default database and verify `/health`, `/readyz`, and `/livez`.

## Evidence

- RED: `cargo test --manifest-path Cargo.toml --test migration_governance_tests migrations_039_through_047_match_applied_database_history -- --nocapture` failed because migration 039 was missing.
- SHA-384 checksums for 039-047 matched the default database `_sqlx_migrations` records before restoring files.
- GREEN: `cargo test --manifest-path Cargo.toml --test migration_governance_tests migrations_039_through_047_match_applied_database_history -- --nocapture` passed after restoring files.
- Runtime: backend started on port 3000 against the default `file_storage` database, and `/health`, `/readyz`, `/livez` all passed.
- Verification: `cargo fmt --manifest-path Cargo.toml -- --check`, `cargo clippy --manifest-path Cargo.toml --all-targets -- -D warnings`, and full `cargo test --manifest-path Cargo.toml` passed.
