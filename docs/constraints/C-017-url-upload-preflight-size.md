# C-017 URL Upload Must Preflight Remote Size

Date: 2026-05-03

## Rule

Frontend URL upload must check `Content-Length` before calling `response.blob()` when the server provides it.

## Why

URL upload runs in the browser. Reading a multi-GB remote response into a `Blob` before validation can spike memory, freeze the tab, or crash mobile browsers.

## Required Pattern

- Validate URL protocol before fetch; only `http:` and `https:` are allowed.
- If `Content-Length` is present and exceeds the frontend upload size limit, add an error upload item and do not read the response body.
- Still run normal `validateFile` after the body is read because `Content-Length` and MIME headers can be missing or wrong.
- Prefer `Content-Disposition` filename when present; otherwise derive the filename from the URL path.
