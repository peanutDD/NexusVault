# C-031: Auto-fix must survive corrupt model patches

## Constraint
When a model-generated unified diff fails to apply and the retry also fails,
`codex-auto-fix` must attempt a bounded full-file replacement fallback for the
same target file before marking a Medium+ review item as pending.

The fallback may only write the reviewed target file and must still pass through
the normal security and quality gates.

## Trigger
PR #12 showed Gemini review comments on `.github/scripts/codex-auto-fix-state.sh`
where Codex generated malformed diffs. `git apply` reported `corrupt patch`, so
the workflow marked both Medium findings as pending even though the fixes were
simple local refactors.

## Effective Date
2026-05-05

## Related Files
- `scripts/codex-cli/src/skills.rs`
- `scripts/codex-cli/src/repo.rs`
- `scripts/codex-cli/tests/e2e_auto_fix.rs`
