# C-030: Frontend visible dimensions must use fluid sizing

Status: active

User-visible frontend dimensions in enforced scopes must use `clamp()`, `rem`,
viewport units, or semantic CSS variables instead of fixed `px` values.
This includes signed values such as `translateY(-1px)` and embedded arithmetic
such as `calc(100% - 56px)`.

Allowed fixed-pixel exceptions are limited to non-scaling hairlines such as
`1px`/`2px`, pill radii such as `999px`, and explicit local exceptions marked
with `fluid-sizing-allow: <reason>`.

Run `npm run check:fluid-sizing` from `frontend/` before merging frontend
layout or style changes. Use `npm run check:fluid-sizing -- --scope=all`
before considering the whole frontend fluid-sizing plan complete.

Reason: fixed visual dimensions accumulate across dialogs, skeletons, tooltips,
and shared surfaces, making the page less adaptive as the viewport changes.
