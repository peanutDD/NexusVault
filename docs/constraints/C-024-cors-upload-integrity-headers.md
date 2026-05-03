# C-024: CORS must allow upload integrity headers

Any browser-facing upload integrity header used by the frontend must be present
in backend CORS `Access-Control-Allow-Headers`.

The chunked upload path sends `X-Part-SHA256` for per-part integrity checks.
Removing this header from CORS causes browser preflight to fail before the
request reaches the handler, leaving uploads stuck in retry loops and making
`complete` fail because the server never receives the chunks.
