# C-321: Generic Upload MIME Must Be Sniffed

## Rule

When an upload or instant-upload request supplies an empty MIME type or `application/octet-stream`, the backend must avoid persisting that generic type for recognizable media:

- Path-based upload flows must inspect the file signature before inserting or updating `files`.
- Recognized extensionless media names must receive a safe display extension such as `.jpg` or `.mp4`.
- Instant upload must inherit the existing content MIME type when the request MIME is generic.
- Existing physical upload files must not be deleted during metadata repair; rename and DB updates require a backup or rollback path.

## Why

On 2026-07-02, extensionless JPEG/MP4 uploads had been stored as `application/octet-stream`. The UI classified them as Docs/File, preview requests returned `Content-Type: application/octet-stream`, and image/video preview was disabled even though the stored bytes were valid media.

## Enforcement

Keep regression coverage in `backend/tests/handler_files_upload_tests.rs` for:

- Multipart upload with no filename extension and generic MIME, using JPEG file signature bytes.
- Instant upload with no filename extension and generic MIME, reusing existing media content metadata.
