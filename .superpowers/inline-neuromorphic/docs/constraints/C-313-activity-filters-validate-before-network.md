# C-313 Activity Filters Validate Before Network

Status: active

Activity filters must validate user-entered identifiers before issuing
`/api/activity` requests. The file, folder, share, request, and token filter
fields must reject values that do not start with their matching prefixes:
`file-`, `folder-`, `share-`, `request-`, and `token-`.

Date-only filters must not be sent to the backend as raw `YYYY-MM-DD` query
values. Convert start dates to the local day's beginning and end dates to the
local day's end as ISO/RFC3339 timestamps before building the request payload.
The date picker must keep future dates disabled and use a filled today state,
not a border-only marker.

When client validation fails, show an inline Neuromorphic correction state and
do not call the activity service. If the backend still rejects a request, render
a detailed Neuromorphic error panel with retry and clear-filter actions instead
of collapsing to the generic "activity record load failed" text. Activity
timeline queries must not retry 400-class filter failures automatically; a bad
filter value must produce at most one request until the user changes the filter
or explicitly retries.

Run `npm run test -- Activity NeuDatePicker`, `npm run lint`, and
`npm run build` after changing Activity filters or the shared NeuDatePicker.
