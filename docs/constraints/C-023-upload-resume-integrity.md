# C-023: Resumable uploads must bind client state to server integrity checks

Chunked upload resume state must be keyed by immutable file identity
(`content_sha256`, size, lastModified, MIME type, target folder, filename) and
validated through the server status endpoint before reuse.

Each uploaded part must send `X-Part-SHA256`; the backend must reject invalid
part hashes and byte lengths before recording the part as uploaded. Retryable
transport failures may preserve the session for resume, while cancellation and
validation failures must clear local resume state and abort the server session.
