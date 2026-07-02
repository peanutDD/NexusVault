# C-044: Gemini Inline Badge Comments Are Actionable Review Input

Gemini Code Assist can place actionable findings in PR inline comments using
image badge markdown such as `![medium]` or `![high]` under headings like
`### path/to/file.tsx:42`.
Headings may include trailing review text after the line number, for example
`### path/to/file.tsx:42: Prefer a stable callback`; the parser must still
extract `path/to/file.tsx` and line `42`.

`scripts/codex-cli review-to-json` must parse those inline badge comments into
structured issues. It must not return `0 actionable issues` when the review body
contains `Medium`, `Medium+`, `High`, or `Critical` inline badge findings.
Badge findings are actionable even when Gemini omits body text and only provides
a severity badge, heading, and optional suggestion block.

If an actionable inline badge finding is parsed but not fixed, the auto-fix
result must surface it through `pending_explanations` / `pending_count` instead
of allowing the workflow to publish a clean-loop message.
