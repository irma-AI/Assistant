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
# Protected: everything outside the free folders, and anything a tool reads as configuration inside them.
for p in .github/workflows/ci.yml guards/pr-title.jq .claude/settings.json .githooks/pre-push CLAUDE.md rulesets/main.json \
  Makefile GNUmakefile makefile mise.toml mise.lock mise.local.toml .mise.toml .config/mise.toml pnpm-workspace.yaml pnpm-lock.yaml \
  package.json tsconfig.json eslint.config.js vite.config.ts vite.config.js vitest.config.ts playwright.config.ts tsr.config.json \
  sgconfig.yml .dependency-cruiser.cjs .squawk.toml .prettierignore .prettierrc prettier.config.js .gitleaksignore .gitleaks.toml \
  .gitattributes .gitignore zizmor.yml Dockerfile .dockerignore cliff.toml README.md docs/guardrails.md docs/agents/routines.md \
  scripts/migrate.ts src/server/migrate.server.ts seeds/0001_people.ts src/CLAUDE.md src/.claude/settings.json src/package.json e2e/package.json \
  src/.gitignore src/.ignore src/eslint.config.js src/.prettierrc.json e2e/playwright.config.ts src/tsconfig.json src/Makefile; do
  check "$p" 1
done
# Free: app code, tests, migrations and plans.
for p in src/routes/index.tsx 'src/routes/posts/$id.tsx' src/server/db.server.ts src/server/db.gen.ts src/routeTree.gen.ts \
  src/styles.css e2e/smoke.spec.ts migrations/0002_status.sql docs/plans/IRM-1.md docs/plans/IRM-1.criteria.json; do
  check "$p" 0
done
exit $fail
