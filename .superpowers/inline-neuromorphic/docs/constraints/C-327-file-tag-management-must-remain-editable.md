# C-327: File tag management must remain editable

Status: active

The Files tag manager is responsible for both file-to-tag assignment and tag
catalog management. It must not regress to an assignment-only checklist.

Rules:

- Existing tags must be renameable from the tag manager dialog.
- Existing tags must be deletable from the tag manager dialog.
- Deleting a tag must remove that tag from the current file assignment state
  before the dialog can save file tags again.
- Deleting a tag relies on the backend `file_tag_assignments.tag_id`
  `ON DELETE CASCADE` relationship so files are no longer categorized under
  the removed tag.
- Tag create, rename, delete, and assignment changes must invalidate `tags`,
  `files`, and smart collection count data when they can affect visible Files
  state.
- The Files page footer must be hidden while the tag manager dialog is open so
  the global footer cannot cover the dialog action area.

Required guards after changing this behavior:

- A dialog-level regression test must prove rename calls `tagsService.update`.
- A dialog-level regression test must prove delete calls `tagsService.remove`
  and a later save excludes the deleted tag id.
- A page-level regression test must prove the Files footer is hidden while the
  tag manager is open and restored after it closes.
- Run `npm --prefix frontend run test -- src/components/files/dialogs/ManageTagsDialog.test.tsx src/pages/Files.test.tsx`.
