# C-062: Applied SQLx migrations are immutable

## Rule

Never edit an existing SQLx migration after it has been applied by any shared, local, CI, staging, or production database.

Schema corrections must be represented as a new forward migration with the next version number.

## Why

SQLx records each migration checksum in `_sqlx_migrations`. If a committed migration file changes after a database has applied it, startup fails before the app can serve traffic:

```text
migration 34 was previously applied but has been modified
```

## Enforcement

`backend/tests/migration_governance_tests.rs` snapshots migration 034 because it has already been applied in the trash-system branch history, and asserts that migration 035 carries the later index rewrite instead.
