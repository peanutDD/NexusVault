# C-084 Codex Auto Fix Must Validate Before Push

Codex Auto Fix must not publish generated patches before running the configured repository verification commands.

Required guard:

- `CODEX_AUTO_FIX_VERIFY_COMMANDS` runs inside `codex-auto-fix` before `git add`, `git commit`, or `git push`.
- A non-zero verification exit blocks the auto-fix commit and leaves the PR for human inspection.
- Frontend changes must run dependency install, lint, and TypeScript checks before publish so generated imports cannot introduce undeclared packages.

Regression test:

- `cargo test --manifest-path scripts/codex-cli/Cargo.toml codex_auto_fix_runs_frontend_pre_push_validation`
- `cargo test --manifest-path scripts/codex-cli/Cargo.toml commit_and_push_runs_configured_verify_commands_before_commit`
