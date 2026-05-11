# C-068: codex-cli repo writes must not follow final symlinks

All codex-cli writes scoped to a repository must reject a final path component that is a symbolic link.

Required behavior:

- `write_repo_file` must not overwrite a symlink target outside the repository.
- changelog and auto-review ledger writes must use the same no-final-symlink write path.
- Unix implementations should use `O_NOFOLLOW` in addition to metadata checks.
- Parent directories may be canonicalized to prove they are inside the repo, but the final component must not be canonicalized and followed for writes.

Rationale:

On 2026-05-11, SecurityCheck found that `resolve_repo_path` canonicalized only the parent directory and then `fs::write` followed a repository-local symlink. That allowed a malicious repository to redirect codex-cli writes to files outside the repository boundary.

