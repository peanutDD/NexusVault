# Exec Plan: Codex Review Loop Second Round Recovery

Date: 2026-05-05

## Goal

Make PR #12 complete the intended Gemini/Codex review loop reliably: two rounds, Medium+ feedback fixed or explicitly blocked for human decision.

## Assumptions

- Gemini has already produced a review for the latest PR head commit.
- Unrelated local frontend and documentation changes are user-owned and must not be staged.
- The current automation should stay event-driven through GitHub Actions and the self-hosted runner.

## Risks

- GitHub Actions concurrency behavior can only be fully proven after pushing and observing a real PR event.
- Backend changes touch upload validation and storage internals; targeted tests must cover both.
- The settings UI review comment appears stale because HEAD already uses the semantic error token.

## Steps

1. Confirm latest Gemini review and failed/cancelled Codex run on PR #12.
2. Move Codex Auto Fix concurrency from workflow scope to job scope so skipped comment events cannot cancel actionable review events.
3. Centralize chunked upload total-part and expected-part-size calculations in `FileService`.
4. Move the S3 copy-source percent-encoding set into the S3 implementation.
5. Add regression tests and permanent constraints.
6. Run targeted verification, commit only scoped files, push, and observe PR #12.
