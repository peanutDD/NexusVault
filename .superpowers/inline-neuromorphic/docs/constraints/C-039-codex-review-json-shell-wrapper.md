# C-039: Codex Review JSON Shell Wrapper

`scripts/codex-cli/tools/review_to_json.sh` must remain available as the shell
entrypoint for converting standardized review Markdown into Review JSON.

The wrapper must delegate to `codex-auto-fix review-to-json` instead of carrying
a second parser, so CI, local scripts, and documentation all share one
conversion contract.

## Why

Earlier workflow guidance named the shell path directly. Removing or forgetting
that path breaks users who adopted the documented MVP even though the Rust CLI
subcommand still works.

## Enforcement

- `scripts/codex-cli/tests/review_to_json.rs`
- `scripts/codex-cli/tools/review_to_json.sh`
