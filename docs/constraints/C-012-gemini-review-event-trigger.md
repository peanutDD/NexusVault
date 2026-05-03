# C-012: Gemini review events must trigger Codex fix

## Constraint
The auto-fix workflow must listen to the real event shape emitted by Gemini Code
Assist. `codex-fix` must support `pull_request_review` submissions from
`gemini-code-assist[bot]`, not only top-level `issue_comment` events.

When the trigger is a pull request review, the workflow must include inline
review comments from that review in `REVIEW_BODY`; passing only the summary body
can drop the actionable file/line findings.

## Trigger
Real PR testing showed the latest `Codex Auto Fix` run only executed
`gemini-kickoff`; `codex-fix` was skipped because Gemini posted a pull request
review rather than a top-level issue comment.

## Effective Date
2026-05-03

## Related Files
- `.github/workflows/ai-auto-fix.yml`

## Exceptions
None.
