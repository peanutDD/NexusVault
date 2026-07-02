# C-007: Shared database integration tests must run serially

Backend integration tests share the `file_storage_test` PostgreSQL database and
call `cleanup_test_data` between cases. Running them in parallel can delete rows
created by another test after a JWT has already been issued, causing foreign-key
failures in upload/session tests.

CI must keep `RUST_TEST_THREADS=1` for backend database tests unless tests are
migrated to isolated per-test databases or transactions.

Upload handler tests additionally use `#[serial(upload_handler_db)]` because
they create JWTs and upload sessions before issuing HTTP requests. Any new test
in `backend/tests/handler_files_upload_tests.rs` must use the same serial key
unless that file moves to per-test databases or transaction rollback.
