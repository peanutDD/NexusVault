# C-317 Decorative Background Animations Must Stay Inert

Decorative canvas backgrounds such as auth ShapeWave and Files fireworks must not participate in page layout, hit testing, or foreground state.

Requirements:
- Mount decorative backgrounds in existing background/effect layers immediately above the owning theme background and before foreground `z-index` content.
- Keep the canvas `aria-hidden` and `pointer-events-none`.
- Keep the canvas fixed/full-viewport so it cannot resize foreground layout.
- Preserve reduced-motion behavior with a still frame instead of an animation loop.
- Do not restore unrelated historical background systems when only one animation layer is requested.
- Page or component entry points that own a decorative background must wire the layer into the correct surface; testing only the standalone background component is not enough.
- Files fireworks must keep the canvas background transparent and use the current Neuromorphic page/theme background; do not add a dedicated fireworks background color token or full-canvas fill.
- Files fireworks must be scoped inside the file-list `neu-flat` surface, above that surface background and below foreground controls; do not mount it in the global `PageLayout` background slot where the file-list surface can cover it.

Regression coverage should assert both presence and inertness, not only snapshots of visual tokens.
