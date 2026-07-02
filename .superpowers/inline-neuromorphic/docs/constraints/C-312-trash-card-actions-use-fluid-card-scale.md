# C-312 Trash Card Actions Use Fluid Card Scale

Status: active

Trash card restore and purge controls must be compact and sized from the card
container, not from icon-library defaults or JSX-local fixed utilities.

The card action row must define fluid variables such as
`--trash-card-action-height` and `--trash-card-action-icon-size` with
`clamp()` and container-relative units. `.trashCardActionButton` must consume
the action height variable, and `.trashCardActionIcon` must set both width and
height from the icon-size variable.

Do not rely on Lucide's default icon size, do not pass fixed `size={24}`-style
props, and do not add Tailwind padding or fixed visual scale classes directly to
the Trash card action buttons. Keep button height, padding, radius, and icon
size in the shared CSS contract so they scale with viewport and card width.

Run `npm run test -- src/pages/Trash.test.tsx` and
`npm run check:fluid-sizing -- --scope=tailwind-filelist-trash` after changing
Trash card actions.
