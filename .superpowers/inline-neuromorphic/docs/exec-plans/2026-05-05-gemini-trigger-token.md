# Exec Plan: Gemini Trigger Token

## Goal
Make automatic `/gemini review` requests use an identity Gemini Code Assist will
actually process.

## Assumptions
- Gemini Code Assist may ignore `github-actions[bot]` comments.
- A repository secret named `GEMINI_REVIEW_TOKEN` can hold a fine-grained PAT or
  app token with permission to comment on PRs.
- The watchdog remains necessary because external review delivery can still fail.

## Risks
- The secret must be configured by a human because it is credential material.
- If the token lacks PR comment permissions, the workflow still fails closed.

## Plan
1. Prefer `secrets.GEMINI_REVIEW_TOKEN` in `gemini-review-kickoff`.
2. Prefer the same token when `codex-auto-fix` requests the next review round.
3. Keep `GITHUB_TOKEN` fallback and watchdog timeout behavior.

## Acceptance
- Workflow code no longer hardcodes `GITHUB_TOKEN` for Gemini trigger comments.
- Missing or ineffective review delivery remains visible through a failed
  watchdog check and `gemini-review-needs-human`.
