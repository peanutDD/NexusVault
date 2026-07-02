# Activity Filter Date Neuromorphic Exec Plan

Date: 2026-06-28

## Scope

Update `/activity` in the frontend to polish activity filters, date picker states, invalid-filter request behavior, and the activity load-failure state inside the current Neuromorphic UI system.

## Assumptions

- The work is limited to `/Users/tyone/github/upload-download-util/.superpowers/inline-neuromorphic`.
- Today is `2026-06-28` in `Asia/Shanghai`; future calendar dates after that must be unavailable.
- The activity API accepts prefixed IDs only when they match the intended filter family: `file-`, `folder-`, `share-`, `request-`, and `token-`.
- Existing pagination, authentication, cached results, and timeline rendering behavior must stay intact.
- CodePen `https://codepen.io/oathanrex/full/azNQpPj` is the visual reference for the Neuromorphic depth and animation language.

## Risks

- The working tree already contains broad unrelated changes, including activity UI files. This task must layer on top of the current state and avoid reverting user work.
- Date picker changes affect every consumer of `NeuDatePicker`, so future-date disabling and today styling must preserve existing portal, short-viewport, and clear/today behavior.
- Invalid filter prevention must not block normal empty filters or valid prefixed IDs.
- Visual fixes must avoid fixed-size pixel layout and preserve fluid `clamp()` sizing.

## Dependencies

- Existing React/Vite frontend scripts: `test`, `lint`, `build`, and focused Vitest tests.
- Existing shared components: `NeuSelect`, `NeuDatePicker`, `PageLayout`, and activity service APIs.
- Existing docs constraints for activity, date picker, fluid sizing, and Neuromorphic primitive usage.

## Implementation Steps

1. Inspect current `/activity`, `NeuDatePicker`, `NeuSelect`, activity service, tests, and Neuromorphic CSS primitives.
2. Add focused tests for dropdown conversion, invalid ID gating, date-only filter stability, today fill styling, and future-date disabled behavior.
3. Replace activity action and target-type free text inputs with generated `NeuSelect` options.
4. Normalize and validate filters before query execution so invalid prefixed IDs show an inline UI issue and do not send a 400-producing API request.
5. Update `NeuDatePicker` so today uses a filled background, future dates are disabled, and inactive out-of-month dates are visually separated without blur/glow.
6. Redesign the activity error state with more detailed Neuromorphic structure, retry/reset actions, and explicit filter guidance.
7. Run focused tests, lint/build checks where practical, and browser validation with Chrome screenshots.
8. Add a permanent constraint if the bug exposes a repeatable project rule; update `docs/quality-score.md` with the final score.

