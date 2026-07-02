# C-311 Trash Console Uses Two-Row Fluid Layout

Status: active

The Trash page console must keep the Vault summary band and action controls as
two separate rows at every breakpoint. The summary row owns `Vault Console`,
file count, total size, retention, and selected count. The action row owns the
left-aligned batch controls and right-aligned return/empty-trash controls.

Do not reintroduce responsive classes or CSS that merge those rows, such as
`lg:flex-row` on `trashConsoleInner` or `sm:w-auto sm:flex-row` on
`trashConsoleActions`.

Trash console action buttons must size from fluid Neuromorphic variables such as
`--trash-console-action-min-height`,
`--trash-console-action-font-size`, and
`--trash-console-action-icon-size`. Button height, text, icon size, padding, and
gaps must use `clamp()`, `em`, viewport units, or semantic variables, never
fixed visual dimensions.

Run `npm run test -- src/pages/Trash.test.tsx`,
`npm run check:fluid-sizing -- --scope=tailwind-filelist-trash`, and
`npm run check:neuromorphic` after changing the Trash console.
