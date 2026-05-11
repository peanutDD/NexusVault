# Exec Plan: codex-cli Symlink-Safe Repo Writes

Date: 2026-05-11

## Goal

Fix the SecurityCheck finding that repo write helpers can follow repository-local symlinks and overwrite files outside the repository.

## Assumptions

- `repo_root` is the trust boundary for codex-cli file writes.
- Reading existing files may still use canonical path checks, but writes must not follow the final path component when it is a symlink.
- `write_repo_file`, changelog writes, and ledger writes are the important write surfaces for this finding.

## Risks

- Some tests or workflows may intentionally use symlinked changelog files; those should now fail closed.
- Unix can enforce `O_NOFOLLOW`; non-Unix platforms rely on explicit symlink metadata checks.
- The check must preserve existing behavior for normal in-repo files and newly-created files.

## Steps

1. Add failing unit tests for `write_repo_file` and `update_changelog` when the target path is a symlink to a file outside the repo.
2. Add a shared safe write helper that rejects final-component symlinks and uses `O_NOFOLLOW` on Unix.
3. Route repo writes, changelog writes, and ledger writes through the helper.
4. Add a permanent constraint and quality score entry.
5. Run codex-cli fmt, tests, and clippy.

