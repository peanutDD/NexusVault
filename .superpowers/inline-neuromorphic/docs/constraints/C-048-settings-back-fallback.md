# C-048: Settings Back requires an in-app fallback

Date: 2026-05-07

## Rule

Settings Back must preserve the previous in-app route when one exists, and must
fall back to `/files` when Settings is opened as the first route.

## Why

History-only Back can send users out of the application or appear to do nothing
when Settings is opened directly. The title icon remains the explicit files-home
shortcut; the Back button should be history-based only when app history exists.

## Required Pattern

- Use router history for normal Settings Back behavior.
- Prefer the router-managed browser history index when available; fall back to
  the initial route key only in test/non-browser routers.
- Detect a direct initial Settings entry and navigate to `/files` with `replace`.
- Keep a regression test for both previous-route preservation and direct-entry
  fallback.
