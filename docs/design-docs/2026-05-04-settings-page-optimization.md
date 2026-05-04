# Settings Page Optimization Design

Date: 2026-05-04

## Goal

Improve the Settings page appearance and low-risk usability without changing backend contracts or breaking account profile, email verification, storage usage, theme selection, password change, or API token workflows.

## Approved Direction

Use conservative polish with a few safe workflow refinements:

- Keep the existing Settings page structure and sections.
- Improve visual hierarchy, mobile wrapping, focus states, and error styling.
- Add lightweight quick navigation behavior where it can be tested without backend dependence.
- Avoid new settings sections or server-side behavior.

## Current Gaps

- Form fields repeat styling and do not consistently use semantic Settings error tokens.
- The email input plus “Get code” button can become cramped on narrow screens.
- The API token heading row uses viewport-scaled text and nowrap, which risks truncation and layout pressure.
- Quick nav links are plain anchors without an active/selected state or section metadata.
- Loading and empty states are functional but visually weaker than the surrounding cards.

## Architecture

The change stays within the frontend Settings boundary:

- `frontend/src/pages/Settings.tsx` remains the page coordinator.
- `frontend/src/components/settings/*` continue owning section behavior and API calls.
- New settings-local presentation helpers may be added under `frontend/src/components/settings/` only when they remove repeated styling without hiding business logic.
- Existing hooks and services remain unchanged.

No backend, auth store, router, or API service contracts change.

## Behavior Preservation

The implementation must preserve:

- Profile save payload shape, profile availability check, and email verification requirement.
- Password validation rules and `authService.changePassword` call shape.
- Theme values: `dark`, `light`, `purple`.
- Storage display based on `useStorageUsage`.
- API token create, copy, one-time display, delete confirmation, and list rendering.

## Testing Strategy

Use TDD for behavior and regression coverage:

- Add focused React Testing Library tests for Settings helpers and/or sections.
- Mock stores, hooks, and services instead of calling real backend APIs.
- Verify key interactions: theme selection, profile changed-email code field, API token create/delete UI states, and responsive-safe class contracts where practical.
- Run frontend unit tests, lint, token checks, and build before claiming completion.

## Visual Verification

Use the in-app browser and/or Playwright screenshots after implementation to inspect Settings at desktop and mobile widths. The page should have no obvious overlap, clipped controls, or broken section navigation.

## Risks

- Refactoring shared form markup can accidentally change field registration or ARIA attributes.
- Tests that mock too much may miss integration issues.
- `.superpowers/` visual companion files are local artifacts and must not be committed.

## Out Of Scope

- New backend APIs or persistence models.
- Billing, data management, organization settings, or permission settings.
- Real deletion or mutation against a live user account during verification.
