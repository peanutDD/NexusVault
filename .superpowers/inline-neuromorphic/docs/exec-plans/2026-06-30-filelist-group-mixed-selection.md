# 2026-06-30 FileList Group Mixed Selection

## Intent

Fix the Files UI bug where selecting a single file or folder makes the group
selection control look fully selected under different sort modes.

## Assumptions

- The issue is visual state drift in the group checkbox styling, not backend
  data or selection mutation.
- `mixed` means partial selection and must be visually distinct from `checked`.
- Existing layout, grouping, sorting, file/folder card behavior, and batch
  selection behavior must remain unchanged.
- The active worktree already contains unrelated dirty changes that must not be
  reverted.

## Risks

- Group checkboxes are shared by type groups, pinned groups, folder groups, and
  time groups, so a visual fix must preserve all four surfaces.
- Existing full frontend tests may still have unrelated failures from the dirty
  worktree; focused regression evidence must separate this fix from those.

## Plan

1. Trace group selection state from item click to group checkbox class.
2. Add a RED regression test proving `mixed` is not allowed inside the checked
   fill CSS rule.
3. Move `fileListGroupSelectCheckboxMixed` out of the checked rule and into the
   neutral group-control treatment.
4. Run focused FileList tests, lint, build, and browser validation when
   practical.
5. Add a permanent constraint and update `docs/quality-score.md`.

## Non-goals

- No layout, sizing, sort, grouping, or data-fetching changes.
- No new selection model or card interaction behavior.
