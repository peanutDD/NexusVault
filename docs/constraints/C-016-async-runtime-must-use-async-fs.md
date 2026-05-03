# C-016 Async Runtime Must Use Async Filesystem

Date: 2026-05-03

## Rule

Code running inside Tokio async functions must use `tokio::fs` for filesystem writes and cleanup unless the operation is intentionally moved to `spawn_blocking`.

## Why

Synchronous filesystem calls inside async tasks can block Tokio runtime worker threads. This is easy to miss for temporary-file cleanup because the code is small, but it becomes a latency risk when automated review/fix loops run concurrently.

## Required Pattern

- Use `tokio::fs::write`, `tokio::fs::remove_file`, and other async filesystem APIs in async command orchestration.
- Keep sync filesystem calls only in non-async helpers or behind `tokio::task::spawn_blocking`.
- Reviewer findings about blocking calls in async contexts must be fixed rather than waived.
