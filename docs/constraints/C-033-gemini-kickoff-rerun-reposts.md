# C-033: Gemini kickoff reruns must repost review requests

## Constraint
`gemini-review-kickoff` must post a fresh `/gemini review` on each run instead
of reusing a previous request comment as proof of progress.

A previous request can fail with a Gemini traffic warning or timeout. Rerunning
the workflow must create a new request so the configured trigger identity and
current service state are actually exercised.

## Trigger
PR #12 showed a rerun after configuring `GEMINI_REVIEW_TOKEN` did not post a new
request because the workflow reused an old `github-actions[bot]` request after
the latest commit. Gemini had already replied with a traffic warning for that
request, so the rerun could only timeout again.

## Effective Date
2026-05-05

## Related Files
- `.github/workflows/gemini-review-kickoff.yml`
