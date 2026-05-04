# C-028: Mobile dialogs must reserve safe viewport spacing

Status: active

Mobile dialog shells must not rely on static `vh` sizing alone. Use dynamic
viewport units (`dvh`) for fixed overlays and combine the intended visual gap
with `env(safe-area-inset-*)` padding on all four sides.

Dialog panels inside those shells must cap both height and width by subtracting
the shell's horizontal and vertical gaps from `100dvh` / `100dvw`. Avoid leaving
conflicting Tailwind `max-h-[*vh]` or `max-w-*` utilities on the same panel when
the component-specific CSS owns viewport sizing.

Reason: mobile browser chrome and safe areas can make static `vh` larger than
the visible viewport, causing dialogs to touch the browser edges even when the
desktop layout has padding.
