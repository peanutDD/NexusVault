# Settings Navigation Simplification Exec Plan

Assumptions: Settings Back returns to the previous real browser history page.
Settings has no internal Quick nav. File and folder navigation remains URL-based
and keeps existing scroll restoration behavior.

Risks: deleting Quick nav must not break Settings sections or Back behavior.
Folder navigation tests must continue proving parent/child restoration.

Dependencies: `Settings.tsx`, Settings navigation tests, file-list navigation
tests, route scroll restoration, and C-036.

Plan: write a failing test proving Quick nav is absent; remove Quick nav state,
hash handling, and aside layout; keep Back as `navigate(-1)`; run focused tests,
lint, full tests, and build.
