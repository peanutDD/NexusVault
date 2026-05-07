# C-035: Literal Medium+ findings are actionable

Gemini Code Assist may emit `Medium+` as a literal severity label, not only as
human shorthand for "Medium and higher".

`scripts/codex-cli` must treat both `Medium` and `Medium+` as actionable by
default:

- `DecisionSkill` must select both severities for automatic fixes.
- `enforce_review_policy` must mark unfixed `Medium` and `Medium+`
  findings as pending.
- `CODEX_ALLOWED_SEVERITIES=Medium` must still include literal `Medium+`
  findings unless the filtering contract is explicitly redesigned.
- Workflow labels, comments, and docs must describe the actionable pending
  scope as `Medium/Medium+/High/Critical`, not only `Medium+`, so human
  reviewers do not assume plain `Medium` or higher findings are ignored.

`Low` findings remain excluded by default.
