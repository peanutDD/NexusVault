# C-315 Light Theme Contrast Tokens Must Cover Shared Surfaces

Date: 2026-06-30

## Rule

Light theme adaptations for shared Neuromorphic surfaces must be expressed through semantic component tokens in the final light theme block, not by letting dark/default white foregrounds bleed into light surfaces.

## Required Practice

- Interactive selection controls must route their unchecked and checked fills, shadows, and glyph colors through semantic tokens such as `--filelist-check-*`.
- Raised and inset light surfaces must pair with dark slate text tokens unless they are explicit primary/success/danger CTA fills.
- Overlay/backdrop layers must use a theme-overridable token, with the light value defined in the light token block.
- Dark theme token blocks are not edited for a light-only contrast fix unless the task explicitly requests a dark theme change.

## Regression Coverage

Every light theme contrast fix must include a focused test that verifies the relevant selector consumes the semantic token, plus a browser/computed-style probe or screenshot for at least one representative surface.
