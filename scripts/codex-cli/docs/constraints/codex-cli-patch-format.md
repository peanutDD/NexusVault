# C-057: codex-cli BatchFix patch format

Date: 2026-05-09

## Constraint

`BatchFixSkill` must use SEARCH/REPLACE block as the primary LLM patch format.

Unified diff may remain as a backward-compatible input format, but it must not be the primary prompt format for new auto-fix generation.

## Reason

LLMs often produce invalid unified diff hunk headers, missing context prefixes, or malformed patch fragments. Those failures surface as `corrupt patch`, `malformed_diff`, or repeated `git apply` retries. SEARCH/REPLACE avoids hunk line counting and lets the runtime give precise match failures back to the model.

## Required Behavior

- Prompt for `### File: <allowed-file>` followed by `<<<<<<< SEARCH` / `=======` / `>>>>>>> REPLACE`.
- Apply SEARCH blocks only when they match the allowed file uniquely.
- Treat missing file headers, wrong file headers, missing markers, and too many blocks as malformed output.
- Retry match failures with expanded context before using full-file fallback.
- Keep full-file fallback behind protected-file and allowed-prefix checks.
- If no file was fixed, skip SecurityCheck / QualityScore / Documentation and report pending reasons instead of scoring original code.
