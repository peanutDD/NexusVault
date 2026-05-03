# Exec Plan: Frontend Upload Logic Review

Date: 2026-05-03

## Goal

Review and upgrade the frontend upload path so cancel/remove behavior, validation, chunked upload cleanup, and status reporting match user expectations.

## Assumptions

- The active upload UI is `frontend/src/components/files/upload/useUploadDialogController.ts`.
- `frontend/src/hooks/files/useFileUpload.ts` is legacy or secondary because no current caller imports it.
- Backend chunked upload abort endpoint is available at `/api/files/upload/chunked/:uploadId/abort`.

## Risks

- Browser `File.type` is often empty, so validation must not rely only on MIME.
- Cancelling a UI item without aborting transport can leave hidden uploads alive.
- Cancelling a running queue item can hang the upload batch if the queue Promise never settles.
- Chunked upload retries can leave server sessions behind unless failures are cleaned up.
- URL upload can read a very large remote body into browser memory before local validation runs.

## Dependencies

- Existing axios API service supports `AbortSignal`.
- Existing upload queue supports cancelling queued tasks.
- Vitest/jsdom can cover signal propagation and validation helpers.

## Steps

1. Inspect current upload UI, upload service, queue, validation, and tests.
2. Add `AbortSignal` propagation through hashing and upload service methods.
3. Wire UI remove/clear actions to abort queued and running uploads.
4. Add MIME fallback validation for common extensions and block dangerous extensions.
5. Add URL upload size preflight before `response.blob()` and filename fallback from `Content-Disposition`.
6. Ensure queued and running upload cancellation settles the queue Promise.
7. Add regression tests and permanent constraint docs.
8. Run targeted tests, lint, typecheck, and build.
