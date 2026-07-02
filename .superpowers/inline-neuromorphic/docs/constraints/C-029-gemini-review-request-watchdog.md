# C-029: Gemini review requests must be observed

## Constraint
Any workflow that posts `/gemini review` must verify that Gemini produced a
review for the latest PR head commit within a bounded timeout.

If no matching Gemini review appears, the workflow must fail closed by adding
`gemini-review-needs-human` and posting a reason. A posted request alone is not
proof that the automated review/fix loop continued.

## Trigger
PR #12 showed `gemini-kickoff` passing after it posted `/gemini review` for
commit `c23939c`, but Gemini did not produce a new review for that commit.

## Effective Date
2026-05-05

## Related Files
- `.github/workflows/gemini-review-kickoff.yml`
- `.github/workflows/codex-auto-fix.yml`
- `.github/scripts/gemini-review-watchdog.sh`
