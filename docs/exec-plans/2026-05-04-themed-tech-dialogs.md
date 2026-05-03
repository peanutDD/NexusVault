# Themed Tech Dialogs

Date: 2026-05-04

## Goal

Upgrade create-folder, batch move, batch delete, batch share, rename, delete, and share dialogs to a more premium technology-forward visual system while preserving existing actions, validation, loading states, and callbacks.

## Assumptions

- File operation dialogs mostly route through `ConfirmDialog appearance="glass"`.
- Single-file sharing routes through `Modal variant="glass"`.
- Theme switching is CSS-variable driven via `data-theme` / `.light` / `.dark` / `.purple`.

## Risks

- A shared dialog change can affect unrelated glass dialogs.
- Stronger visual effects can obscure content or reduce contrast across themes.
- Wider dialog panels must still fit mobile screens.

## Steps

1. Add focused dialog tests that assert the new tech shell is applied while close/confirm behavior remains unchanged.
2. Implement the themed tech shell in the common dialog components.
3. Add dark, light, and purple theme tokens for the tech surface, grid, edges, and glow.
4. Run targeted tests, frontend lint, full frontend tests, and frontend build.

## Validation

- `npm test -- --run src/components/common/dialog/ConfirmDialog.test.tsx src/components/common/dialog/Modal.test.tsx`
- `npm run lint`
- `npm test`
- `npm run build`
