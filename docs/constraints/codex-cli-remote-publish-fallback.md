# C-060: Codex remote publish must not depend on git push only

Date: 2026-05-11

## Constraint

`codex-cli` auto-fix publishing must not fail solely because `git push` hit a transient GitHub HTTPS transport error.

## Required Behavior

- Retry transient `git push` failures such as `Empty reply from server`, connection reset, timeout, HTTP/2 stream, and TLS failures.
- If all `git push` attempts fail for a transient network reason, publish the current commit through the GitHub Git Data API using `gh api`.
- Keep `git push` as the fast path because it is simpler and preserves normal Git behavior.
- Keep the API fallback non-force and branch-scoped; never overwrite an unrelated remote ref.
- Surface a hard error only after both transport paths fail.

## Reason

GitHub Actions runners can intermittently fail HTTPS Git pack transfer while `api.github.com` remains usable. A known-good auto-fix commit should not be lost just because one transport path flapped.
