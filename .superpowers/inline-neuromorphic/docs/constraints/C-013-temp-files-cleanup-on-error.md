# C-013: Temporary files must be cleaned on error

## Constraint
Any code path that creates temporary prompt, patch, archive, or processing files
must clean them up on success, command failure, and timeout/error exits.

## Trigger
Gemini Review found that `run_local_codex_command` removed prompt files after a
successful `wait_with_output`, but an early `output?` error could skip cleanup.

## Effective Date
2026-05-03

## Related Files
- `scripts/codex-cli/src/llm.rs`

## Exceptions
None.
