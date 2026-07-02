# Exec Plan: Backend Startup Warning Cleanup

## Assumptions

- Target backend: `/Users/tyone/github/upload-download-util/.superpowers/inline-neuromorphic/backend`.
- Startup warning floods are caused by stale database file rows whose local storage objects are absent from `./uploads`.

## Changes

- Reproduce the warning path from startup/runtime logs.
- Add a regression test proving the maintenance checker cleans `AppError::NotFound` storage misses.
- Treat missing local storage objects as orphan records in maintenance cleanup.
- Lower expected missing-record list logs from `WARN` to `DEBUG`.
- Collapse per-row cleanup logs into one summary `INFO` per maintenance cycle.

## Verification

- `cargo fmt --manifest-path Cargo.toml -- --check`
- `cargo test --manifest-path Cargo.toml --test maintenance_tests -- --nocapture`
- `cargo test --manifest-path Cargo.toml --test handler_webdav_tests api_file_list_omits_missing_local_storage_records -- --nocapture`
- `cargo clippy --manifest-path Cargo.toml --all-targets -- -D warnings`
- Exact plain `cargo run` stayed running on port 3000.
- `/health` and `/readyz` returned healthy database/storage checks.
- Runtime log polling after startup produced no new warning or error output.
- `git diff --check` passed.
