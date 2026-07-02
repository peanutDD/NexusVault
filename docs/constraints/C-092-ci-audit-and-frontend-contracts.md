# C-092: CI audit and frontend contracts must fail on stable behavior, not stale implementation details

## Rule

`Security audit (cargo-audit)` runs with `--deny warnings`; high vulnerabilities and denied warnings must be removed from the dependency graph. Do not silence them with audit ignores unless the PR includes a time-bounded security exception and owner-approved risk note.

Frontend contract tests must assert stable behavior or semantic hooks. They must not depend on incidental CSS indentation, whitespace, or classes that belong to a parent wrapper after a component boundary has moved.

## Why

The 2026-07-03 automation validation PR failed because:

- `docx-lite` pinned vulnerable `quick-xml 0.36.2`.
- `pdf-extract -> lopdf` kept the denied `ttf-parser` warning in the lockfile.
- `validator` derive pulled the unmaintained `proc-macro-error2` warning.
- Two frontend tests still asserted old implementation details after recent neuromorphic/modal refactors.

## Enforcement

- Run `cd backend && cargo audit --deny warnings` before publishing CI repair PRs.
- Keep document text extraction on dependency chains that pass audit.
- Run focused frontend tests for any updated style or dialog contract before publishing.
