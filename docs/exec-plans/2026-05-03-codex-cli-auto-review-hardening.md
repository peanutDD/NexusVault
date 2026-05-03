# codex-cli auto review hardening exec-plan

Date: 2026-05-03

## Assumptions

- Scope is the local `scripts/codex-cli` auto review/fix workflow.
- The workflow should keep using local Codex execution, not GPT API orchestration beyond the existing OpenAI-compatible client.
- PR feedback remains human-gated: Codex fixes or explains, human decides merge/review loop.

## Risks

- Multi-round execution can repeat the same review input until the next Gemini review arrives, so the loop must stop on no successful fixes or quality threshold.
- Model outputs can drift from requested JSON, so security and quality gates must parse strictly and fail visibly.
- PR comments may be disabled in local runner mode, so unresolved medium+ issues must still appear in machine-readable JSON.

## Dependencies

- `scripts/codex-cli/src/runtime.rs`
- `scripts/codex-cli/src/skills.rs`
- `scripts/codex-cli/src/config.rs`
- `scripts/codex-cli/src/types.rs`
- `scripts/codex-cli/docs/design-docs/pipeline.md`
- `scripts/codex-cli/docs/references/configuration.md`

## Verification

- Add unit tests for parsing, retry state, loop exit, unresolved issue explanations, and model defaults.
- Run `cargo fmt` and `cargo test` in `scripts/codex-cli`.
