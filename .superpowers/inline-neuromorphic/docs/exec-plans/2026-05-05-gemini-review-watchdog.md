# Exec Plan: Gemini Review Watchdog

## Goal
Make the automatic Gemini/Codex review loop fail closed when a `/gemini review`
request does not produce a Gemini review for the latest PR head commit.

## Assumptions
- Gemini may occasionally ignore or delay a request.
- GitHub Actions can poll PR reviews and comments through `gh api`.
- A missing Gemini review is not equivalent to a clean review.

## Risks
- A long timeout keeps the runner occupied.
- A short timeout can flag slow Gemini responses as human-required.
- The watchdog must not treat old reviews on previous commits as valid.

## Plan
1. Add a reusable watchdog script with testable plan mode.
2. Make `gemini-review-kickoff` wait for a Gemini review after posting or
   detecting a recent `/gemini review` request.
3. Make the Codex state machine use the same watchdog when it requests the next
   review round.
4. Add regression tests for found and timeout states.

## Acceptance
- Missing Gemini review yields `gemini-review-needs-human` and a failing check.
- Existing or new Gemini review for the latest head lets the workflow proceed.
- Local `cargo test` and shell syntax checks pass.
