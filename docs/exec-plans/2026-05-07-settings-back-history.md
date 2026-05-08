# Settings Back History Exec Plan

Settings should return to the previous browser/router history entry, preserving
the source route and query string, instead of hardcoding the files home route.

## Intent

Change the Settings header action from `Back to Home` to `Back` and make it use
history navigation so `/files?folder=...` and other source pages survive the
round trip.

## Assumptions

- The previous page is represented by React Router history.
- Preserving query params is more important than forcing `/files`.
- Existing Settings form, token, theme, and logout behavior must remain unchanged.

## Risks

- A hardcoded route drops folder context and causes users to lose their place.
- Tests must exercise Settings as a routed page, not only isolated sections.
- Existing drag-move work in the dirty tree is unrelated and must not be reverted.

## Dependencies

- `frontend/src/pages/Settings.tsx`
- `frontend/src/components/settings/SettingsPageRegression.test.tsx`
- `docs/constraints/C-036-navigation-scroll-restoration.md`

## Steps

1. Add a failing regression for `/files?folder=folder-1 -> /settings -> Back`.
2. Change the Settings action to `navigate(-1)` and label it `Back`.
3. Keep C-036 as the governing permanent constraint.
4. Run focused Settings tests, lint, full frontend tests, and build.
