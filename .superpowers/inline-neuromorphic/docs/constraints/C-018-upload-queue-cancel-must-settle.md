# C-018 Upload Queue Cancel Must Settle

Date: 2026-05-03

## Rule

`UploadQueue.cancel(id)` must settle the Promise returned by `UploadQueue.add(id, ...)`, including when the task is already running.

## Why

Upload cancellation can abort the underlying network request, but the UI awaits the queue Promise. If a running task is only marked cancelled and its rejection is swallowed, batch upload orchestration can hang forever.

## Required Pattern

- Cancelling a waiting task removes it from the heap and rejects the queued Promise.
- Cancelling a running task rejects the queued Promise immediately with an abort-like error.
- The caller remains responsible for aborting the underlying transport through `AbortController`.
- Later task resolution/rejection must not re-open UI state after cancellation.
