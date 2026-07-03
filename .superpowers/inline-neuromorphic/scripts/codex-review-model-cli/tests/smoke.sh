#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cli_root="$(cd -- "${script_dir}/.." && pwd)"
project_root="$(cd -- "${cli_root}/../.." && pwd)"
repo_root="$(cd -- "${project_root}/../.." && pwd)"
cli="${cli_root}/bin/codex-review-model"

fail() {
  echo "smoke: $*" >&2
  exit 1
}

[[ -x "$cli" ]] || fail "CLI must be executable"
[[ -f "${repo_root}/.github/workflows/ci.yml" ]] || fail "root CI workflow is missing"
[[ -f "${repo_root}/.github/workflows/codex-code-review.yml" ]] || fail "root Codex review workflow is missing"
[[ -f "${repo_root}/.github/workflows/codex-auto-fix.yml" ]] || fail "root Codex auto-fix workflow is missing"
[[ -f "${repo_root}/.github/workflows/gemini-review-kickoff.yml" ]] || fail "root legacy Gemini workflow is missing"

plan="$("$cli" plan)"
grep -q '^model=gtp-5.5$' <<< "$plan" || fail "default model must be gtp-5.5"
grep -q '^review_marker=<!-- nexusvault-codex-review -->$' <<< "$plan" || fail "review marker missing"

grep -q 'CODEX_REVIEW_MODEL: gtp-5.5' "${repo_root}/.github/workflows/codex-code-review.yml" \
  || fail "Codex review workflow must pin gtp-5.5"
grep -q 'nexusvault-auto-review-status' "${repo_root}/.github/scripts/review-status-comment.sh" \
  || fail "status script must use a stable marker"
if grep -q 'GEMINI_REVIEW_TIMEOUT_SECONDS: 600' "${repo_root}/.github/workflows/gemini-review-kickoff.yml"; then
  fail "legacy Gemini kickoff must not wait 600s"
fi

checks="$(
  CHANGED_FILES='.superpowers/inline-neuromorphic/backend/src/lib.rs .superpowers/inline-neuromorphic/frontend/src/main.tsx .superpowers/inline-neuromorphic/scripts/codex-review-model-cli/bin/codex-review-model' \
    "$cli" targeted-checks --changed-only --print
)"
grep -q 'cargo fmt --all -- --check' <<< "$checks" || fail "backend targeted checks missing"
grep -q 'npm run lint' <<< "$checks" || fail "frontend targeted checks missing"
grep -q 'tests/smoke.sh' <<< "$checks" || fail "review CLI targeted checks missing"

echo "codex-review-model-cli smoke ok"
