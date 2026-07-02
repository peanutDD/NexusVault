# C-025: Upload hashing and S3 copy source must preserve large-file safety

Frontend full-file SHA-256 for uploads must use bounded chunk reads. Do not use
`file.arrayBuffer()` or Web Crypto `subtle.digest` on the entire upload file,
because large files can exhaust browser memory before the request starts.

S3 `copy_object` copy sources must percent-encode object keys while preserving
`/` separators. Spaces, `#`, `?`, `%`, and non-ASCII characters in source keys
must be covered by tests before changing copy behavior.
