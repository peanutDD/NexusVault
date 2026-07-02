# C-011: Test matchers must assert

## Constraint
Tests must not call matcher expressions such as `matches!(...)` as standalone
statements. Wrap them in `assert!(matches!(...))` or use an equivalent explicit
assertion.

## Trigger
PR review found several tests where `matches!(...)` returned a bool that was
discarded, so the test looked like it checked an error variant but did not.

## Effective Date
2026-05-03

## Related Files
- `backend/tests/service_auth_tests.rs`
- `backend/tests/service_file_tests.rs`
- `backend/tests/service_storage_tests.rs`
- `backend/tests/middleware_tests.rs`

## Exceptions
None.
