# Exec Plan: Upload Completeness Hardening

Date: 2026-05-04

## Goal

Implement the upload completeness review items from P0 to P3: folder ownership validation, isolated backend upload tests, real chunked resume, per-part integrity checks, streaming instant-copy, complete metrics, and removal of unused upload hooks.

## Assumptions

- The active upload UI controller is `frontend/src/components/files/upload/useUploadDialogController.ts`.
- `frontend/src/hooks/files/useFileUpload.ts` is unused by current application code and can be removed after its cancellation coverage moves to the active controller.
- `upload_sessions.uploaded_parts` is the backend source of truth for chunked resume state.
- A retryable transport failure should preserve a chunked session for resume; explicit cancellation or validation failure should abort and clear local resume state.
- Folder ids are user-owned resources and must be verified for normal upload, instant upload, and chunked complete.

## Risks

- Shared PostgreSQL integration tests can delete each other's users/sessions when run in parallel.
- Reusing a stale local chunked session can resume the wrong file if the key is not bound to immutable file identity.
- Accepting a short or wrong chunk before marking it uploaded can make final merge fail later or create silent corruption.
- Instant upload across users can read large existing objects into memory if implemented with `get_file` + `save_file`.
- Removing a legacy hook without moving its coverage can hide regressions in the live upload dialog.

## Dependencies

- Backend `FoldersRepo::exists(folder_id, user_id)` for ownership checks.
- Backend `UploadSessionsRepo` for chunked status and progress.
- Frontend `sha256FileHex` and `sha256BlobHex` helpers.
- `serial_test` for shared database integration test isolation.
- Existing metrics helper `record_file_operation`.

## Implementation Summary

1. Added folder ownership validation in the shared file service path and covered it for normal upload, instant upload, and chunked complete.
2. Marked upload handler integration tests with `#[serial(upload_handler_db)]` to prevent shared DB cleanup races.
3. Implemented frontend chunked resume state keyed by `content_sha256`, size, lastModified, MIME type, folder, and filename.
4. Added `X-Part-SHA256` on every chunk upload and backend validation for header format, checksum mismatch, and expected part byte length.
5. Changed instant upload cross-user copy to storage-level copy: local filesystem copy or S3 `copy_object`, avoiding full object reads into memory.
6. Recorded `chunked_upload_complete` metrics for success and failure.
7. Removed unused `useFileUpload` hook and moved cancellation/folder propagation coverage to `useUploadDialogController`.
8. Added permanent constraints C-015 update and C-023.

## Verification

- `cargo fmt --all --check`
- `cargo check`
- `cargo test --test handler_files_upload_tests -- --nocapture`
- `cargo test --test service_file_tests test_file_service_chunked_upload -- --nocapture`
- `cargo test invalid_chunk_size_maps_to_validation_error -- --nocapture`
- `npm test -- fileUploadService.test.ts useUploadDialogController.test.tsx uploadValidation.test.ts`
- `npm exec tsc -b`
