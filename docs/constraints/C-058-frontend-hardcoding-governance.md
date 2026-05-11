# C-058 Frontend Hardcoding Governance

Frontend runtime code must not introduce deployment URL fallbacks, raw Tailwind
theme palette classes, inline color functions, or unnamed timing literals.

Use these sources instead:

- Deployment URLs: `frontend/src/config/env.ts`
- API URLs for navigation/downloads: `apiPath()`
- User-facing network base messages: `apiBaseForMessage()`
- Colors and gradients: semantic CSS variables in token/style files
- Timing values: named constants close to the behavior they control

Allowed exceptions must be explicit with `hardcoding-allow: <reason>`. SVG
namespaces, placeholder example URLs, and CSS token definitions are not runtime
hardcoding.

Run `npm run check:hardcoding` from `frontend/` before merging frontend runtime
changes.
