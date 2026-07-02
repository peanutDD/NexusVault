# C-058: Actionable Gemini Findings Must Block Until Resolved

Date: 2026-07-02

## Constraint

Gemini Code Assist findings with severity `Medium`, `Medium+`, `High`, or `Critical` must never be converted to a clean/merge-ready state unless every actionable finding is `resolved`.

The default two-round loop is only an automatic budget. It is not permission to ignore unresolved findings.

## Required Statuses

Actionable findings may only use these final issue statuses:

- `resolved`: Codex fixed the finding and verification did not block publication.
- `pending_fix_failed`: Codex attempted the fix but patch generation, patch application, retry, or fallback did not resolve it.
- `blocked_external`: network, Codex quota/timeout, GitHub connectivity, runner interruption, missing Gemini response, or another external dependency blocked repair.
- `blocked_policy`: protected file, dangerous path, docs filtering, or another policy requires human approval before modification.
- `blocked_push`: local repair was generated but pre-push validation, `git commit`, `git push`, or GitHub API fallback failed. PR comment publication failures must be recorded separately and must not make a successfully pushed repair look push-blocked.

`Low` and `Info` may remain `tracked`.

## Required Evidence

Every non-`resolved` actionable status must include:

- Concrete cause (`failure_reason`).
- Failed stage (`failure_stage`).
- Whether retry is appropriate (`retryable`).
- Blocked action (`blocked_action`).
- Executable remediation (`remediation`).

PR comments and local ledger entries must be rendered from the same `issue_statuses` data.

## Manual Reruns

After the default 2 automatic rounds, unresolved or blocked findings must set `gemini-review-needs-human`, not `gemini-review-clean`.

Humans may continue with round 3 or later by fixing the cause, removing `gemini-review-round-max`, adding `gemini-review-round-3` or a later round label, and requesting `/gemini review`.
