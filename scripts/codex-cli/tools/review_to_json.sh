#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
CRATE_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"

cargo run --quiet --manifest-path "${CRATE_DIR}/Cargo.toml" --bin codex-auto-fix -- \
  review-to-json "$@"
