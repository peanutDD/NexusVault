# C-053: Codex Auto-Fix Diff Preflight

Date: 2026-05-09

## Constraint

`codex-auto-fix` must validate LLM-generated unified diffs before invoking `git apply`.

For the single-file auto-fix path, a patch is only allowed to reach `git apply` when:

- It starts with exactly one `diff --git a/<allowed-file> b/<allowed-file>` header.
- It contains matching `---` and `+++` file headers for the allowed file.
- It contains at least one valid `@@ -old,+new @@` hunk header.
- It does not target any file other than the review issue file.

Malformed fragments must be classified as `malformed_diff` by the preflight layer and sent into the existing retry/fallback flow without producing noisy raw `git apply` corruption logs.

## Why

Gemini/Codex review repair output can drift into patch fragments such as bare `@@` hunks, missing trailing `@@`, or cross-file fragments. Passing those directly to `git apply` creates repeated `corrupt patch` / `patch fragment without header` failures and makes the real blocker harder to understand.

## Required Tests

- Unit coverage for patch fragments without `diff --git`.
- Unit coverage for malformed hunk headers.
- E2E coverage must keep retry/fallback behavior working after preflight rejection.
- Security audit failures must surface in pending explanations so blocked auto-fix runs are legible.
