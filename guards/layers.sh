#!/usr/bin/env bash
# Architecture layers from .dependency-cruiser.cjs: first proves each rule catches its own
# fixture (and lets an API route import *.server.ts), then checks the real code.
set -euo pipefail
cd "$(dirname "$0")/.."
cruise() { pnpm exec depcruise src scripts --config .dependency-cruiser.cjs --output-type err "$@" 2>&1; }

fixture=
trap '[ -z "$fixture" ] || rm -f "$fixture"' EXIT
# try <rule or "pass"> <file> <import specifier>
try() {
  fixture=$2
  mkdir -p "$(dirname "$fixture")"
  printf "import '%s'\n" "$3" > "$fixture"
  out=$(cruise) && ok=1 || ok=0
  rm -f "$fixture"; rmdir -p --ignore-fail-on-non-empty "$(dirname "$fixture")" 2> /dev/null || true; fixture=
  if [ "$1" = pass ]; then
    [ "$ok" = 1 ] || { echo "::error::layers: the rules reject $2 importing $3. Fix: correct .dependency-cruiser.cjs."; exit 1; }
  else
    { [ "$ok" = 0 ] && grep -q "$1" <<< "$out"; } || { echo "::error::layers: rule $1 missed $2 importing $3. Fix: correct .dependency-cruiser.cjs."; exit 1; }
  fi
}
try pass src/routes/api/v1/__fixture.ts ../../../server/migrate.server
try server-only src/components/__fixture.ts ../server/migrate.server
try ui-through-api src/features/__fixture.ts ../server/db.gen
try ui-through-api src/routes/__fixture.ts ../server/db.gen
try ui-through-api src/platform/__fixture.ts ../server/db.gen
try server-no-ui src/server/__fixture.ts ../routes/index
try api-self-contained src/api/__fixture.ts ../server/db.gen
try capacitor-in-platform src/components/__fixture.ts @capacitor/core

cruise
echo "layers: scanned $(git ls-files -co --exclude-standard -- 'src/*.ts' 'src/*.tsx' 'scripts/*.ts' | wc -l | tr -d ' ')"
