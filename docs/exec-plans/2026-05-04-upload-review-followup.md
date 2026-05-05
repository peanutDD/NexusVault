# Upload Review Follow-Up Exec Plan

## Goal

Fix the two unresolved PR review findings:

- Avoid browser OOM risk when hashing large files in the frontend upload path.
- URL-encode S3 `copy_object` copy source keys.
- Make codex-cli recover from one stale/invalid generated patch instead of stopping at the first `git apply` failure.

## Assumptions

- Upload APIs and persisted resume metadata keep their current shape.
- S3 bucket names are already valid bucket identifiers; only object keys need percent-encoding.
- Browser Web Crypto cannot incrementally hash large files, so full-file SHA-256 should use bounded chunk reads.
- A single retry with the latest source is enough to address line/context drift without hiding persistent patch-generation bugs.

## Risks

- Worker tests need to exercise the actual worker handler without a browser Worker runtime.
- S3 copy source encoding must preserve `/` separators in object keys.
- codex-cli retry must stay bounded to one attempt so it cannot loop indefinitely.

## Verification

- Add failing frontend tests for whole-file `arrayBuffer()` avoidance.
- Add a failing backend unit test for S3 copy source encoding.
- Add a failing codex-cli e2e test where the first patch cannot apply and the retry succeeds.
- Run targeted frontend and backend tests after implementation.
