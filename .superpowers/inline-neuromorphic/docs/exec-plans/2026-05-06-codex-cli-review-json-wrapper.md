# codex-cli review JSON shell wrapper and PR handoff

Date: 2026-05-06

## Assumptions

- The existing Rust `review-to-json` subcommand is the source of truth for
  Markdown-to-JSON conversion.
- The earlier documented shell path must remain available for workflow snippets
  and local adopters.
- The current dirty codex-cli review JSON changes belong in one PR.

## Risks

- A second shell parser would drift from the Rust implementation.
- Publishing can be blocked by GitHub auth, branch state, or remote permission.
- Full project CI is broader than this codex-cli-only change; local evidence
  should focus on codex-cli tests, lint, workflow syntax, and wrapper behavior.

## Plan

1. Add a failing test for `scripts/codex-cli/tools/review_to_json.sh`.
2. Implement the wrapper as a thin delegate to `codex-auto-fix review-to-json`.
3. Document the compatibility path and add a permanent constraint.
4. Run focused red/green verification and full codex-cli gates.
5. Stage intended files, commit, push, and open a draft PR.
