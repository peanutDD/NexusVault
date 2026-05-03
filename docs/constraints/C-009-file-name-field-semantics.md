# C-009: File tests must distinguish storage and display names

`files.filename` is the internal storage filename and may include a generated
identifier or sanitized prefix. User-visible name assertions must use
`files.original_filename`.
