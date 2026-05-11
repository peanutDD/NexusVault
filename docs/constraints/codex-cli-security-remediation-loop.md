# C-059: Codex SecurityCheck findings must enter remediation

Date: 2026-05-10

## Constraint

When `codex-cli` `SecurityCheckSkill` reports a finding for a modified file, the auto-fix loop must attempt one bounded security remediation pass before feedback or push.

## Required Behavior

- Convert each `SecurityCheck` finding of the form `<file>: <reason>` into a synthetic High-severity issue scoped to that file.
- Run the existing BatchFix patch path for those synthetic issues before posting final feedback.
- Re-run SecurityCheck after a security remediation patch succeeds.
- If remediation fails, report the finding as pending; do not label it as merely "not pushed".
- Never run unbounded self-remediation loops.

## Reason

Reporting a security finding without attempting the available automatic fix leaves the system in a known-bad state. Not pushing may reduce blast radius, but it does not resolve the underlying risk.
