# C-310 Neuromorphic Surfaces Use One Global Primitive System

All frontend pages and shared components must render ordinary surfaces through
the global Neuromorphic primitives:

- `neu-flat`
- `neu-raised`
- `neu-raised-sm`
- `neu-inset`
- `neu-pressed`

Semantic fills such as success, warning, danger, and primary actions may keep
their color meaning, but they must not define a separate depth system. Their
depth must reuse the same `--neu-*` shadow direction or intentionally use no
shadow.

Active UI code must not introduce:

- surface gradients or `background-image: var(...)`
- glass, tech, scanline, glow, backdrop blur, or decorative border residue
- visible persistent borders on primitive surfaces
- page-specific raised/inset shadow aliases
- Tailwind arbitrary background variables such as `[background:var(...)]`

When a visual component is retired, remove its orphan TSX, isolated tests,
private glyph CSS, and private tokens in the same cleanup pass. Do not keep
inactive page-specific surface systems as "future" styling hooks.

Focus-visible outlines, semantic text colors, icons, and disabled readability
states remain allowed when they do not create a second surface material system.

Run these checks from `frontend/` before merging visual surface changes:

```bash
npm run check:neuromorphic
npm run check:fluid-sizing
npm run lint
npm run build
```

The `check:neuromorphic` script intentionally excludes `src/styles/tokens.css`
so historical token definitions can be migrated safely, but active pages and
component CSS must stay clean.
