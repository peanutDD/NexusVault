# C-092: CI audit and frontend contracts must fail on stable behavior, not stale implementation details

## Rule

`Security audit (cargo-audit)` runs with `--deny warnings`; high vulnerabilities and denied warnings must be removed from the dependency graph. Do not silence them with audit ignores unless the PR includes a time-bounded security exception and owner-approved risk note.

Frontend contract tests must assert stable behavior or semantic hooks. They must not depend on incidental CSS indentation, whitespace, or classes that belong to a parent wrapper after a component boundary has moved.

Audit-safe document extraction must preserve common text semantics:

- PDF text extraction must decode `/Filter /FlateDecode` content streams before scanning text operators.
- DOCX text extraction must preserve predefined XML entity references and numeric character references inside `w:t`.

## Why

The 2026-07-03 automation validation PR failed because:

- `docx-lite` pinned vulnerable `quick-xml 0.36.2`.
- `pdf-extract -> lopdf` kept the denied `ttf-parser` warning in the lockfile.
- `validator` derive pulled the unmaintained `proc-macro-error2` warning.
- Two frontend tests still asserted old implementation details after recent neuromorphic/modal refactors.
- The first audit-safe PDF fallback scanned raw PDF bytes only, so compressed text streams were missed.
- The first audit-safe DOCX fallback ignored `Event::GeneralRef`, so `R&amp;D`, angle brackets, and numeric references lost characters.

## Enforcement

- Run `cd backend && cargo audit --deny warnings` before publishing CI repair PRs.
- Keep document text extraction on dependency chains that pass audit.
- Keep regression tests for compressed PDF streams and DOCX entity references when changing extraction code.
- Run focused frontend tests for any updated style or dialog contract before publishing.
