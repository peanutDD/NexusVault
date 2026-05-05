# Exec Plan: Codex CLI Medium Plus Severity

## Goal
Make `scripts/codex-cli` clean both literal `Medium` and literal `Medium+`
Gemini Code Assist findings.

## Assumptions
- Gemini can emit `Medium+` as a literal severity label.
- `Medium+` findings must be selected for automatic fixing by default.
- Unfixed `Medium+` findings must create `pending_explanations`.

## Risks
- The automatic fix path and pending policy path can drift if they use separate
  severity checks.
- Custom `CODEX_ALLOWED_SEVERITIES` values can accidentally exclude `Medium+`.

## Plan
1. Add failing regression tests for literal `Medium+` selection and pending.
2. Centralize severity matching in `types.rs`.
3. Include `Medium+` in the default allowed severity set.
4. Update docs and permanent constraints.
5. Run targeted `codex-cli` tests.

## Acceptance
- `Medium` and `Medium+` are both selected by default.
- `Medium+` unfixed findings block clean status through pending output.
- `cargo test medium_plus` passes.
