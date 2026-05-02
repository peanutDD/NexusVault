# Frontend Large Component Split Exec Plan

Date: 2026-05-03

## Scope

- Split `UploadDialog.tsx` into a view shell and a controller hook.
- Split `FilePreviewContent.tsx` into stage, text panel, and state components.
- Split `MarkdownPreview.tsx` into schema/utils and focused renderers.
- Fix the React Compiler lint violation in `useThrottle`.
- Keep upload queue behavior, folder query parameter support, warnings, and close semantics unchanged.
- Keep each touched file under 300 lines.

## Assumptions

- `UploadDropzone`, `UploadUrlForm`, and `UploadProgressList` already own their visual sub-responsibilities.
- `UploadDialog.tsx` should remain the public component entry point.
- Existing `scripts/codex-cli/*`, workflow, and constraints working tree changes are unrelated and must not be touched.

## Risks

- Moving upload orchestration can break `folderId` propagation to `uploadFileWithInstant`.
- Closing during uploads must remain blocked.
- StrictMode-safe ref/state synchronization must be preserved.
- Preview stage extraction must preserve click-to-close and stop-propagation behavior.
- Markdown renderer extraction must preserve sanitize/proxy/copy-code behavior.

## Verification

- `npm test -- uploadValidation.test.ts`
- `npx tsc -b --pretty false`
- `npm run lint`
- `npm run build`
