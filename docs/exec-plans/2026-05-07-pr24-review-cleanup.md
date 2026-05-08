# PR 24 Review Cleanup Exec Plan

PR #24 had Gemini inline comments with `Medium` and `High` badges, but the
auto-fix loop reported `pending_count=0`. The cleanup fixes both the review
pipeline classification bug and the concrete PR review comments.

## Intent

Parse Gemini inline badge comments as actionable review issues, prevent false
clean-loop status, and address the remaining PR #24 Medium/High comments in the
frontend drag-move code.

## Assumptions

- Gemini inline comments are available in the workflow input under
  `## Inline Review Comments`.
- `Medium`, `Medium+`, `High`, and `Critical` inline badge comments are
  actionable by the existing auto-fix policy.
- The PR code changes should preserve the drag-move behavior already covered by
  the existing regression tests.

## Risks

- Returning zero parsed issues for inline badge comments can cause a false
  "no Medium/Medium+ pending" PR comment.
- Missing `pointer-events-none` can make mobile drop target detection hit the
  dragged card itself.
- Breadcrumb drops can bypass selected-batch expansion unless handled in the
  shared action hook.

## Dependencies

- `scripts/codex-cli/src/review_json.rs`
- `scripts/codex-cli/tests/review_to_json.rs`
- `frontend/src/components/files/grid/FileCard.tsx`
- `frontend/src/components/files/grid/FolderCard.tsx`
- `frontend/src/components/files/list/FileList.tsx`
- `frontend/src/components/files/grid/MixedGrid.tsx`
- `frontend/src/components/files/grid/VirtualizedMixedGrid.tsx`
- `frontend/src/hooks/files/useFileActions.ts`

## Steps

1. Add failing tests for inline badge review parsing and remaining PR review
   behaviors.
2. Parse `### file:line` inline sections with `![medium]`, `![medium+]`,
   `![high]`, or `![critical]` badges.
3. Add mobile dragging `pointer-events-none`, reset preview suppression on new
   pointer interactions, memoize drag adapters, and expand selected breadcrumb
   drops.
4. Run frontend, codex-cli, lint, and build verification before pushing the PR
   update.
