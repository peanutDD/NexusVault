# C-032: Gemini review trigger must use a user-capable token

## Constraint
Workflows that post `/gemini review` must prefer `secrets.GEMINI_REVIEW_TOKEN`
over the default `GITHUB_TOKEN`.

`GITHUB_TOKEN` comments can be ignored by Gemini Code Assist. If the dedicated
token is not configured, the workflow may fall back to `GITHUB_TOKEN`, but a
watchdog timeout must remain fail-closed.

## Trigger
PR #12 showed `github-actions[bot]` comments timing out without a Gemini review,
while a `peanutDD` comment received a Gemini reaction and produced a review.

## Effective Date
2026-05-05

## Related Files
- `.github/workflows/gemini-review-kickoff.yml`
- `.github/workflows/codex-auto-fix.yml`
