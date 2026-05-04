# Exec Plan: Gemini Kickoff Rerun Reposts

## Goal
Ensure rerunning `gemini-review-kickoff` creates a fresh Gemini request instead
of waiting on a stale failed request.

## Assumptions
- Duplicate `/gemini review` comments are acceptable because the watchdog bounds
  the run and Gemini may fail due to temporary traffic.
- The workflow still skips `codex auto-fix` commits because the Codex state
  machine owns those next-round requests.

## Risks
- Manual reruns can consume additional Gemini quota.
- If Gemini service is unhealthy, repeated reruns still fail closed.

## Plan
1. Remove stale request reuse from `gemini-review-kickoff`.
2. Always post a fresh request for non-auto-fix commits.
3. Keep watchdog verification tied to the fresh request timestamp.

## Acceptance
- Workflow reruns exercise the currently configured trigger token.
- Traffic-warning or timed-out requests do not block a fresh retry.
