# C-056: Codex Auto-Fix Malformed Diff Direct Fallback

Date: 2026-05-09

## Constraint

When `codex-auto-fix` classifies an LLM patch as `malformed_diff`, it must not
ask the model for another unified diff retry. It must go directly to the
full-file fallback path, subject to protected-file and allowed-prefix gates.

`git push` from auto-fix must retry transient network errors such as:

- `Empty reply from server`
- `Failed to connect`
- connection resets or timeouts
- unexpected remote disconnects

## Why

Malformed diffs are usually structural output failures, not context drift. Asking
for another diff often repeats the same failure and produces noisy logs such as
`git apply failed ... corrupt patch`. Direct full-file fallback is the reliable
recovery path.

GitHub occasionally returns transient push errors from self-hosted runners.
Failing the whole auto-fix after a successful local commit leaves the review loop
stuck even though retrying the push is safe.

## Enforcement

- E2E coverage must assert malformed diffs skip retry-patch generation and use
  full-file fallback.
- Repo preflight must reject hunk header and hunk body count mismatches before
  raw `git apply`.
- Unit coverage must classify transient git push errors as retryable.
