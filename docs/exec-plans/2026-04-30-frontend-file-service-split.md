# Frontend File Service Split Exec Plan

Date: 2026-04-30

## Scope

- Split the frontend file service into domain services while preserving the existing `fileService` import path.
- Extract `FileList` dialog rendering into a dedicated component so `FileList.tsx` stays focused on list orchestration.
- Keep existing behavior intact and avoid deleting legacy entry files in this slice.

## Assumptions

- `frontend/src/services/files.ts` is a public compatibility facade used by current hooks and components.
- Existing list, upload, preview, and dialog components are already partially organized under `components/files/`.
- A safe first PR should reduce the largest coupling points without rewriting upload or preview UI internals.

## Risks

- Moving object methods can break `this` references in upload methods if the facade binding is changed incorrectly.
- Download streaming logic depends on browser File System Access API types and must remain behaviorally identical.
- Import cycles can appear if domain services import the aggregate `files.ts` facade.

## Dependencies

- React 19 frontend.
- Vite, TypeScript, Vitest.
- Existing `api`, `limitedApi`, auth store, telemetry, and file/folder hooks.

## Verification

- Add a service facade contract test before implementation.
- Run the targeted service test after splitting.
- Run frontend `build` if dependencies are available locally.
