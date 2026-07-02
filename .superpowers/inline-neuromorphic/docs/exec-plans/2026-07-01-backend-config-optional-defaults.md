# 2026-07-01 Backend Config Optional Defaults

## Intent

Fix backend startup when `STORAGE_PATH` is omitted and make exact plain `cargo run` load the required local development values.

## Assumptions

- The active target is `.superpowers/inline-neuromorphic/backend`.
- The reported failure happens inside `Config::from_env()` before database connection setup.
- `STORAGE_PATH` is documented as optional for local storage and should default to the repository-level `uploads` path.
- OAuth settings are optional and must remain disabled when no OAuth environment variables are present.
- Local development should use ignored `backend/.env` values because the binary loads `.env`, not `.env.local`.

## Risks

- Adding empty-string defaults for optional integrations could accidentally enable runtime branches.
- Environment-based tests can be flaky if they do not restore modified variables.
- Full backend integration tests may depend on a local PostgreSQL service outside this fix.

## Plan

1. Reproduce the startup failure with only `DATABASE_URL` and `JWT_SECRET` set.
2. Add a RED unit test for `Config::from_env()` with optional config sections omitted.
3. Add the minimal config defaults needed before deserialization.
4. Add the ignored local `.env` needed for plain `cargo run`.
5. Verify the focused config test, backend formatting/lint checks, and exact plain `cargo run`.
6. Record the new permanent constraint and update `docs/quality-score.md`.

## Evidence

- RED: `cargo test --manifest-path Cargo.toml from_env_defaults_storage_path_when_env_missing -- --nocapture` failed with `LoadError(missing field path)`.
- RED: `cargo test --manifest-path Cargo.toml from_env_reports_missing_ -- --nocapture` failed with `LoadError(missing field database)` and `LoadError(missing field jwt_secret)`.
- GREEN: `cargo test --manifest-path Cargo.toml from_env_defaults_optional_sections_when_env_missing -- --nocapture` passed.
- GREEN: `cargo test --manifest-path Cargo.toml from_env_reports_missing_ -- --nocapture` passed.
- Focused config tests: `cargo test --manifest-path Cargo.toml --lib config -- --nocapture` passed.
- Formatting/lint: `cargo fmt --manifest-path Cargo.toml -- --check` and `cargo clippy --manifest-path Cargo.toml --all-targets -- -D warnings` passed.
- Startup probe without `STORAGE_PATH` moved past config loading and failed at the intentionally unreachable database connection.
- Added ignored local `backend/.env` with `DATABASE_URL`, `JWT_SECRET`, `STORAGE_BACKEND`, `STORAGE_PATH`, `PORT`, `CORS_ORIGIN`, and `FILES_CONSISTENCY_CHECK_BATCH_SIZE`.
- Exact plain `cargo run` in `backend/` started successfully, stayed running on port 3000, and returned healthy `/health` plus `/readyz` responses.
- The prior full-test migration blocker was resolved by restoring migrations 039-047.
