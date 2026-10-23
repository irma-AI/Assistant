#!/usr/bin/env bash
# Every protected path fails without an issue; an ordinary path passes. MESSAGE is empty, so the
# script stops before it would ask Linear.
set -uo pipefail
here=$(dirname "$0")
fail=0
check() {
  printf '%s\n' "$1" > "${TMPDIR:-/tmp}/protected-paths.test"
  MESSAGE='' "$here/protected-paths.sh" "${TMPDIR:-/tmp}/protected-paths.test" > /dev/null 2>&1
  got=$?
  if [ "$got" = "$2" ]; then echo "ok    $1"; else echo "FAIL  $1: exit $got, want $2"; fail=1; fi
}
for p in .github/workflows/ci.yml guards/pr-title.jq .claude/settings.json .githooks/pre-push CLAUDE.md rulesets/main.json Makefile mise.toml mise.lock pnpm-workspace.yaml tsconfig.json eslint.config.js vite.config.ts sgconfig.yml .dependency-cruiser.cjs .squawk.toml package.json vitest.config.ts playwright.config.ts tsr.config.json scripts/migrate.ts src/server/migrate.server.ts docs/agents/routines.md; do
  check "$p" 1
done
for p in src/routes/index.tsx docs/plans/IRM-1.md e2e/smoke.spec.ts; do check "$p" 0; done
exit $fail
