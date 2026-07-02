# Upload Completeness Hardening

Date: 2026-05-04

## Scope

This document records the current upload integrity design after the P0-P3 hardening pass. It covers normal upload, instant upload, chunked upload resume, test isolation, and the active frontend upload controller.

## Ownership Boundary

`folder_id` is a user-owned resource. Any upload path that writes a file into a folder must verify that the folder belongs to the authenticated user before creating or updating file records.

Covered paths:

- Normal multipart upload: validates folder ownership before file creation.
- Instant upload: validates folder ownership before hash lookup/copy and record insertion.
- Chunked upload complete: validates folder ownership before final file creation.

The check is centralized in `FileService::ensure_folder_belongs_to_user`, backed by `FoldersRepo::exists(folder_id, user_id)`.

## Chunked Resume Contract

Frontend chunked resume state is opportunistic and never replaces server state. A local resume record is only reused after `chunkedUploadStatus(uploadId)` confirms the server session still exists and matches the expected `total_parts`.

The local resume key binds the session to immutable file identity:

- `content_sha256`
- file size
- `lastModified`
- MIME type
- target folder id or root
- filename

Retryable network failures preserve the session so the next attempt can continue from `uploaded_parts`. User cancellation and non-retryable validation failures abort the server session and clear the local record.

## Chunk Integrity Contract

Each chunk request sends:

- `Content-Type: application/octet-stream`
- `X-Part-SHA256: <64 hex chars>`

The backend rejects a chunk before recording it as uploaded when:

- part index is outside `1..=total_parts`
- `X-Part-SHA256` is malformed
- the computed SHA-256 does not match the header
- the byte length does not equal the expected part length

Expected size rules:

- non-final chunks must equal `CHUNK_SIZE`
- final chunk must equal `total_size - CHUNK_SIZE * (total_parts - 1)`

This ensures `upload_sessions.uploaded_parts` only contains chunks that are both complete and content-verified.

## Instant Upload Copy Contract

Instant upload matches by `content_sha256 + file_size`. If the matched file already lives under the current user's storage path, the file path can be reused. If it belongs to another user or the path owner cannot be parsed, storage must copy it to a new current-user path.

Copying is performed through `StorageBackend::copy_file_to_user`:

- Local storage uses filesystem copy into the target user/file path.
- S3 storage uses object-side `copy_object`.

This avoids reading large matched files into memory.

## Metrics

Chunked complete records file operation metrics:

- operation: `chunked_upload_complete`
- success: file size is recorded in `file_operation_size_bytes`
- failure: increments error count with size `0`

## Frontend Controller Boundary

The active upload orchestration lives in `frontend/src/components/files/upload/useUploadDialogController.ts`.

The unused legacy hook `frontend/src/hooks/files/useFileUpload.ts` has been removed. Regression coverage for cancellation and folder propagation now targets `useUploadDialogController`.

## Test Isolation

Backend upload handler tests share the `file_storage_test` PostgreSQL database and call `cleanup_test_data`. They must run under `#[serial(upload_handler_db)]` or another per-test isolation strategy. This prevents one test from deleting a user or upload session while another test still uses its JWT/session.
