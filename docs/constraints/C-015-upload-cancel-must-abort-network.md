# C-015 Upload Cancel Must Abort Network

Date: 2026-05-03

## Rule

Any frontend upload cancellation action must propagate an `AbortSignal` through hashing, instant-upload checks, normal upload requests, chunked upload requests, and retry delays.

## Why

Removing an uploading file from the UI without aborting the underlying request leaves hidden network work running. For chunked uploads this can also leave server-side upload sessions alive, consume bandwidth, and later refresh the file list with a file the user believed was cancelled.

## Required Pattern

- Create one `AbortController` per queued upload item.
- Pass its signal through all upload service methods and request calls.
- Treat queue cancellation and `AbortError`/`ERR_CANCELED` as user cancellation, not a user-visible upload failure.
- Abort the server chunked upload session when a chunked upload fails or is cancelled after init.
- Add regression tests for signal propagation and chunked-session cleanup.
