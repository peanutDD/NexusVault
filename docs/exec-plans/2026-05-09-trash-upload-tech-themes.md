# Trash Upload-Tech Themes Exec Plan

## Goal
Unify the `light`, `purple`, and `dark` Trash pages around the UploadDialog tech glass language while preserving Trash layout and file actions.

## Assumptions
- Trash keeps the current information architecture: 10 columns on desktop/tablet, 5 columns on mobile, 82% thumbnail area, one-line truncated filename.
- Existing restore, permanent delete, empty trash, back navigation, query invalidation, and confirmation flows remain unchanged.
- Theme switching continues to use CSS variables under `data-theme` / `.light` / `.purple`.

## Risks
- Overlay density can reduce mobile readability, so card overlays stay low-opacity and non-interactive.
- Light mode must remain opal/light, not a dark page with light text.
- Purple mode should be restrained cyan/magenta glass, not heavy neon.

## Dependencies
- `frontend/src/styles/tokens.css`
- `frontend/src/pages/Trash.tsx`
- `frontend/src/styles/trashThemeTokens.test.ts`
- `frontend/src/pages/Trash.test.tsx`

## Verification
- `npm run test -- src/styles/trashThemeTokens.test.ts src/pages/Trash.test.tsx`
- `npm run lint -- --quiet`
- `npx tsc -b --noEmit`
- `npm run build`
- Generate desktop/mobile screenshots for dark, light, and purple under `docs/evidence/`.
