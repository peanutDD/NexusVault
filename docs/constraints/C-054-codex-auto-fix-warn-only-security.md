# C-054: Codex Auto-Fix Warn-Only Security Audit

Date: 2026-05-09

## Constraint

`codex-auto-fix` prompt-based SecurityCheck is warn-only. It must record and
publish security findings, but it must not set `push_blocked` or stop an
otherwise generated auto-fix commit.

Full-file fallback must not be blocked by a global line-count cap. The remaining
fallback hard stops are:

- Protected files such as lockfiles, package manifests, and `.env`.
- Paths outside the configured source/script allow-list.

## Why

Prompt-based security review is useful as a signal, but it is not a deterministic
security scanner. Treating it as fail-closed caused too many valid High priority
auto-fixes to stay local and prevented the review loop from progressing.

The previous 300-line fallback cap also blocked real frontend files such as
`frontend/src/components/files/grid/FileCard.tsx`, so actionable findings could
remain unresolved even when a full-file fallback was available.

## Enforcement

- Security audit failures must keep `security_passed=false` and add pending
  explanations.
- Security audit failures must keep `push_blocked=false` and allow commit/push
  when `--yes` is used.
- Large files must be eligible for full-file fallback when they pass protected
  path and allow-list checks.
