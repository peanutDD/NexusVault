# C-061: Self-hosted Codex Auto-Fix must not rely only on Git HTTPS checkout

## Rule

`codex-auto-fix` runs on the local `file-server` runner and must not use `actions/checkout@v4` as its only repository bootstrap path.

The first workspace setup step must:

- seed from a local repository checkout when available,
- verify or reconstruct the exact PR head SHA,
- use GitHub API tarball as the network fallback instead of Git smart HTTP fetch,
- fail closed before running auto-fix if the exact PR head cannot be verified,
- set `CODEX_PUBLISH_VIA_GH_API=true` when using a synthetic local baseline.

## Why

The local runner has repeatedly failed before codex-cli starts:

```text
fatal: unable to access 'https://github.com/peanutDD/upload-download-util/': Empty reply from server
fatal: unable to access 'https://github.com/peanutDD/upload-download-util/': Failed to connect to github.com port 443
```

Retries inside codex-cli cannot help when `actions/checkout` fails first. The workflow needs a bootstrap path that avoids Git HTTPS pack transfer and preserves exact PR-head safety.

## Enforcement

`scripts/codex-cli/tests/workflow_state.rs` asserts that `.github/workflows/codex-auto-fix.yml` uses resilient local/API checkout markers and does not contain `actions/checkout@v4`.
