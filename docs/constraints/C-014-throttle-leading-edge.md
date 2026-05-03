# C-014: Throttle hooks preserve leading edge updates

## Constraint
Throttle hooks must update immediately when the throttle window has elapsed.
Cleanup must not turn throttle behavior into debounce behavior by clearing the
pending timer on every value change.

## Trigger
Gemini Review found that `useThrottle` always scheduled through `setTimeout`,
including after the delay had elapsed, reducing UI responsiveness for high
frequency interactions.

## Effective Date
2026-05-03

## Related Files
- `frontend/src/hooks/useThrottle.ts`
- `frontend/src/hooks/useThrottle.test.ts`

## Exceptions
None.
