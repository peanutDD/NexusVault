# Frontend Hardcoding Audit Exec Plan

## Intent

Count and reduce frontend hardcoding without changing page layout or user flows.

## Assumptions

- CSS token files are the allowed source of color values.
- SVG namespaces, documentation examples, and placeholder URLs are not deploy
  configuration hardcoding.
- Local development fallback URLs are allowed only in `config/env.ts` and must
  be documented with `hardcoding-allow`.

## Risks

- A broad color regex can flag legitimate design token definitions.
- Replacing Tailwind palette classes with semantic variables can change visual
  output if the token value does not match the old class.
- Timeout values with runtime meaning should become named constants, not hidden
  in generic config.

## Implementation

- Added `frontend/scripts/check-hardcoding.mjs`.
- Added `frontend/scripts/check-hardcoding.test.mjs`.
- Added `npm run check:hardcoding`.
- Replaced runtime `localhost:3000` fallbacks with `apiPath()` and
  `apiBaseForMessage()`.
- Replaced raw runtime Tailwind palette classes with semantic CSS variables.
- Replaced direct TSX color functions and unnamed timeout literals with tokens
  or named constants.

## Verification

- `npm run check:hardcoding`
- `npx vitest run scripts/check-hardcoding.test.mjs`
- `npm run check:fluid-sizing -- --scope=all`
- `npm run check:fluid-sizing -- --scope=tailwind-visual`
- `npm test`
- `npm run lint`
- `npm run build`
