# AGENTS.md - codex-review-model-cli

Scope: `scripts/codex-review-model-cli/`.

- This is the Codex review-model automation path. Do not modify or replace
  `scripts/codex-cli/` from this directory.
- Default review model is `gtp-5.5`, override with `CODEX_REVIEW_MODEL` only.
- Keep stdout stable for subcommands that are consumed by workflows. Diagnostics
  should go to stderr.
- Never print secrets such as `CODEX_REVIEW_COMMAND`, GitHub tokens, or local
  Codex credentials.
- Use one PR status comment identified by `<!-- nexusvault-auto-review-status -->`.
