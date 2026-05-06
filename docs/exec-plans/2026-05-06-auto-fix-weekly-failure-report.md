# Auto-Fix Weekly Failure Report Exec Plan

Date: 2026-05-06

## Goal

Add the smallest operational loop that turns `codex-auto-fix` JSON outputs into a weekly Top 5 failure report and makes reviewer comments easier for automation to parse.

## Assumptions

- `pr-auto-fix` and `auto-fix-local` already emit `apply_fail_reason`, `fallback_used`, `final_status`, and `pending_explanations`.
- A JSONL file of auto-fix outputs is enough for the first weekly report workflow.
- Reviewer template guidance belongs in `docs/CODE_REVIEW_GUIDE.md`.
- `git apply --check` should stay out of the default path until real samples justify it.

## Risks

- Pretty JSON and JSONL inputs can drift if the parser supports only one shape.
- Failed runs may have no modified `files`, so the report needs a fallback path source.
- A broad workflow integration would exceed the minimal closure and add scheduling risk.

## Dependencies

- `scripts/codex-cli/src/types.rs` output contract.
- `scripts/codex-cli/src/bin/codex.rs` command routing.
- `docs/CODE_REVIEW_GUIDE.md` reviewer guidance.
- `docs/constraints/` permanent rules.

## Plan

1. Add failing tests for a weekly report builder and CLI command.
2. Add failing docs tests for the reviewer template and C-040 apply-check policy.
3. Implement a JSON/JSONL report builder grouped by `apply_fail_reason`, file path, `fallback_used`, and `final_status`.
4. Add `codex-auto-fix auto-fix-weekly-report --input <jsonl> --output <md>`.
5. Add the structured Review template to the code review guide.
6. Add C-040 so weekly reporting and the `git apply --check` policy remain permanent.
7. Update quality score and verify targeted tests.

## Acceptance

- `cargo test --manifest-path scripts/codex-cli/Cargo.toml --test auto_fix_report` passes.
- `cargo test --manifest-path scripts/codex-cli/Cargo.toml --test review_governance_docs` passes.
- The report contains Top 5 rows and excludes non-failure runs.
