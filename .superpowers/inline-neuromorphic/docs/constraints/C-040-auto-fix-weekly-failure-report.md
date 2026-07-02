# C-040: Auto-Fix Weekly Failure Report

`codex-auto-fix` failure reviews must include a weekly Top 5 report grouped by
`apply_fail_reason`, file path, `fallback_used`, and `final_status`.

The report input must come from the machine-readable JSON emitted by
`pr-auto-fix` or `auto-fix-local`, not from free-form logs. If a failed run did
not modify files, the report may recover the file path from
`pending_explanations`.

`git apply --check` must not be added by default. Add it only after real failure
samples show that a dry-run would produce clearer diagnostics or prevent a
specific repeated failure mode.

中文约束：没有真实失败样本证明收益前，`git apply --check` 不得默认增加。

## Why

The auto-fix loop already captures apply failure classification, retry count,
fallback use, and final status. A weekly Top 5 keeps optimization focused on
observed failure patterns instead of adding broad retries or extra commands on
speculation.

## Enforcement

- `scripts/codex-cli/tests/auto_fix_report.rs`
- `scripts/codex-cli/tests/review_governance_docs.rs`
- `docs/CODE_REVIEW_GUIDE.md`
