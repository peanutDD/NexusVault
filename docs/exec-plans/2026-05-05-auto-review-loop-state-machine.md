# Auto Review Loop State Machine Exec Plan

## Goal

Make the Gemini review + local Codex repair loop provably handle two rounds,
pending Medium+ findings, CI verification, and human decision gates.

## Assumptions

- `codex-cli` handles one Gemini review payload at a time.
- GitHub Actions labels own the cross-review loop state.
- `MAX_ROUNDS=2` is the default operating mode, while the state script keeps
  the round math generic.
- A `codex auto-fix` commit should trigger CI; duplicate Gemini review requests
  are avoided in `gemini-review-kickoff`.

## Risks

- Gemini may not respond to every `/gemini review` request; the workflow must
  expose labels/comments so humans can see whether it is waiting, clean, or
  blocked.
- Self-hosted runners can have stale globally installed binaries, so the
  workflow must execute the repository version of `codex-auto-fix`.

## Tasks

1. Add failing tests for `codex-auto-fix` JSON fields:
   `has_pending`, `pending_count`, and `review_clean`.
2. Add a tested workflow state script that maps
   `fixed/push_blocked/pending_count/current_round` to labels and next review
   behavior.
3. Update `codex-auto-fix.yml` to call the repository CLI via `cargo run` and
   route all outcomes through the state script.
4. Update `gemini-review-kickoff.yml` to skip `codex auto-fix` commits because
   the auto-fix workflow owns the next review request.
5. Remove `[skip ci]` from auto-fix commit messages.
6. Update permanent constraints, usage docs, and quality score.

## Verification

- `cargo test` in `scripts/codex-cli`
- `bash -n .github/scripts/codex-auto-fix-state.sh`
- local state-script plan tests for pending, clean, blocked, and final states
