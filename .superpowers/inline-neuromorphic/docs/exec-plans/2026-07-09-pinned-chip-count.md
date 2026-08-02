# 2026-07-09 Pinned Chip Count

## Goal

Fix the Files page smart collection chip counts so toggling a file's pinned or
favorite flag updates the visible chip count immediately.

## Out Of Scope

- Backend count API changes.
- Chip styling, layout, or collection rail behavior changes.
- Upload workflow changes beyond preserving existing count invalidation.
- Reverting unrelated existing worktree changes.

## Assumptions

- The stale chip count is caused by `file-collection-counts` cache remaining at
  the old value until the invalidated query refetches.
- Pinned group counts already update because `FileListContent` patches local
  file metadata optimistically.
- Collection count queries are scoped by current folder, search, and MIME
  filters, so all cached count query variants should be patched consistently.

## Risks And Dependencies

- Existing worktree changes touch the same files; edits must be minimal and
  preserve those changes.
- Count cache updates must roll back if the flag API request fails.
- React Query query-key matching must cover all `file-collection-counts`
  variants without touching unrelated caches.

## Files Likely To Change

- `frontend/src/components/files/list/FileListContent.tsx`
- `frontend/src/components/files/list/FileListContent.test.tsx`
- `docs/constraints/*`
- `docs/quality-score.md`

## Test Strategy

First failing test:

- Preload `file-collection-counts` cache with `pinned: 2`, render an already
  pinned file, click "Toggle pinned", and assert the cached `pinned` count
  immediately becomes `1`.

Additional coverage:

- Mirror the same optimistic cache behavior for favorite count updates.
- Verify rollback restores count cache on API failure if practical in the same
  test scope.

## Verification Commands

- `npm run test -- FileListContent`
- `npm run test -- FileListSelectionBar`
- `npm run lint -- --quiet`
- `npm run build`

## Observability Evidence

- Test output proving the cache-level regression is covered.
- Browser or Playwright screenshot proving the visible chip shows the updated
  count after an unpin action.
- Logs and metrics are not applicable because this is frontend cache state.

## Rollback Strategy

Use a small patch limited to the files above. If verification fails, revert only
the changes from this task and keep unrelated worktree changes intact.
