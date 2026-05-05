# C-035: Literal Medium+ findings are actionable

Gemini Code Assist may emit `Medium+` as a literal severity label, not only as
human shorthand for "Medium and higher".

`scripts/codex-cli` must treat both `Medium` and `Medium+` as actionable by
default:

- `DecisionSkill` must select both severities for automatic fixes.
- `enforce_review_policy` must mark unfixed `Medium+` findings as pending.
- `CODEX_ALLOWED_SEVERITIES=Medium` must still include literal `Medium+`
  findings unless the filtering contract is explicitly redesigned.

`Low` findings remain excluded by default.
