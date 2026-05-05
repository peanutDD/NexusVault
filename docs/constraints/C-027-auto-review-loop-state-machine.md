# C-027: Auto review loop state must be explicit and testable

The Gemini/Codex auto-review loop must not infer merge readiness from
`fixed=false` alone. `codex-auto-fix` output must expose whether Medium+ issues
remain pending, and the workflow must route through a tested state machine:

- `pending_explanations` non-empty means the PR is not clean.
- `push_blocked=true` must stop the loop and require human action.
- a clean first round requests the second Gemini review when `MAX_ROUNDS=2`.
- a clean final round adds `gemini-review-round-max` and `gemini-review-clean`.
- unresolved final-round pending items add `gemini-review-needs-human`.

Auto-fix commits must run CI. Duplicate Gemini requests are prevented by the
kickoff workflow skipping commits whose message contains `codex auto-fix`.
