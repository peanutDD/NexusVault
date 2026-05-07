# Exec Plan: Auto Review Transparency And Remaining Medium Cleanup

Date: 2026-05-07

## Intent

Clear the current PR #24 Gemini Medium finding and make codex-cli comments show
which Medium/Medium+ issues were fixed versus left unresolved.

## Assumptions

- The latest unresolved Medium is the mobile drag target detection issue in
  `FileCard.tsx`.
- `FolderCard.tsx` shares the same pointer-hit risk and should use the same
  helper.
- Existing full-file fallback line limits should remain conservative; the
  reviewer-facing gap is lack of clear fixed/unfixed issue reporting.

## Risks

- Pointer hit stack behavior differs by browser, so the helper must retain the
  `elementFromPoint` fallback.
- Changing `PrAutoFixOutput` must preserve existing fields consumed by the
  workflow.

## Steps

1. Add red tests for covered mobile drop targets.
2. Add red codex-cli test requiring fixed and unfixed issue sections.
3. Implement shared pointer hit-stack target lookup.
4. Add `fixed_explanations` and review status blocks to codex-cli output and PR
   comments.
5. Fix the follow-up High self-drop guard by filtering the target folder out of
   folder moves without blocking selected files.
6. Verify frontend and codex-cli tests, lint, build, and PR review state.
