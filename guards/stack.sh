#!/usr/bin/env bash
# Stack guards: the mistakes agents make most with TanStack Start, and secrets kept out of
# the browser bundle. The rules live in guards/ast-grep/, each with valid and invalid cases.
set -euo pipefail
cd "$(dirname "$0")/.."
ast-grep test --skip-snapshot-tests
for p in src/pages app/layout.tsx src/app/layout.tsx; do
  [ ! -e "$p" ] || { echo "::error::stack: $p is a Next.js layout; the app is TanStack Start. Fix: put routes in src/routes/."; exit 1; }
done
n=$(git ls-files -co --exclude-standard -- 'src/*.ts' 'src/*.tsx' | wc -l | tr -d ' ')
[ "$n" -gt 0 ] || { echo "::error::stack: no source files to scan."; exit 1; }
ast-grep scan --error src
echo "stack: scanned $n"
