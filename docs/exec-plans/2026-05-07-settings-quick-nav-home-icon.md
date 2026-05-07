# Settings Quick Nav Removal Exec Plan

Settings should not render the Quick nav sidebar or same-page hash links. The
history Back button remains a previous-page action, and the title-left icon is
the only Settings-local route back to files home.

## Intent

Remove Settings Quick nav and make the Settings header icon navigate to `/files`
when the user explicitly wants home from the Settings title area.

## Assumptions

- The existing `Back` button must keep using router history via `navigate(-1)`.
- The Settings section order and section components remain unchanged.
- The title-left icon is the requested home affordance and needs an accessible
  button name.

## Risks

- Reintroducing hash quick nav links would pollute Settings with unused in-page
  navigation.
- Making `Back` hardcode `/files` would regress folder/query preservation.
- The icon-only button must stay keyboard and screen-reader reachable.

## Dependencies

- `frontend/src/pages/Settings.tsx`
- `frontend/src/components/settings/SettingsPageRegression.test.tsx`
- `docs/constraints/C-036-navigation-scroll-restoration.md`

## Steps

1. Add failing routed regressions for Quick nav absence and title icon `/files`
   navigation.
2. Remove `SETTINGS_SECTIONS`, the Quick nav aside, and the two-column layout.
3. Convert the title-left `Settings2` icon wrapper into an accessible button
   that calls `navigate("/files")`.
4. Run focused Settings tests, lint, full frontend tests, build, and a Settings
   screenshot check.
