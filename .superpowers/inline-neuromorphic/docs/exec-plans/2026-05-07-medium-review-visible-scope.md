# Exec Plan: Medium Review Visible Scope

Goal: make the Gemini/Codex auto-review loop visibly treat plain `Medium`
findings as actionable alongside literal `Medium+` findings.

Assumptions:

- The Rust severity matcher already selects `Critical`, `High`, `Medium+`, and
  `Medium` by default.
- The failing behavior is reviewer-facing workflow wording that narrows pending
  and clean states to `Medium+`.
- `Low` findings remain excluded by default.

Risks:

- Changing only wording must not alter the tested state machine decisions.
- Future docs must not reintroduce a `Medium+`-only interpretation.

Plan:

1. Add a failing workflow-state test requiring state labels and comments to say
   `Medium/Medium+`.
2. Update `.github/scripts/codex-auto-fix-state.sh` pending/clean labels and PR
   comments.
3. Update constraints and reference docs to use the same actionable scope.
4. Run focused workflow-state tests, shell syntax check, and codex-cli tests.
