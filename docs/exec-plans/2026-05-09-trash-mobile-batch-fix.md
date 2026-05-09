# Trash Mobile Batch Fix Exec Plan

## Summary

Trash cards now use the same visual structure as the home file cards on mobile:
three columns at the smallest breakpoint, square thumbnails, shared checkbox
component, centered file text, and Trash-only restore/permanent-delete buttons
inside each card. Batch restore and batch permanent delete keep the existing
public API routes. The Vault Console summary chip uses `max-content` sizing on
desktop with a viewport cap, and fills the mobile toolbar content width like the
home search row. The mobile Console stack uses a slightly larger row gap, while
the base actions row stays right-aligned. The Trash page now uses the same
`--filelist-page-bg` page background as the home file list, and its Vault
Console toolbar is sticky below the fixed navigation while the Trash content
scrolls.

## Verification

- `npm test -- Trash.test.tsx`
- `npm run lint`
- `npm run build`
- `cargo fmt --check`
- `cargo clippy --all-targets --all-features -- -D warnings`
- `cargo test --test handler_files_trash_tests`
- Focused service tests for soft delete, batch restore, and batch permanent delete.
- Runtime curl/API check: batch restore restored 1 file with 0 failures; batch
  permanent delete removed 1 trashed file with 0 failures.
- Mobile browser measurement after the latest Console adjustment: summary row
  339px inside a 362px console, `align-self: stretch`, row gap 7px, base actions
  `flex-end` with 0px right gap inside its action container.
- Mobile sticky browser measurement: page root class is
  `bg-[color:var(--filelist-page-bg)]`; Console computed `position: sticky`,
  top `77px`; after scrolling Trash content 520px, top stayed `77px`.

## Evidence

- `docs/exec-plans/2026-05-09-trash-mobile-3col-evidence.png`
- `docs/exec-plans/2026-05-09-trash-desktop-layout-evidence.png`
- `docs/exec-plans/2026-05-09-trash-mobile-console-full-width-evidence.png`
- `docs/exec-plans/2026-05-10-trash-sticky-console-evidence.png`
