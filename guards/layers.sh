#!/usr/bin/env bash
# Architecture layers from .dependency-cruiser.cjs: first proves the rules catch a component
# importing server-only code, then checks the real code.
set -euo pipefail
cd "$(dirname "$0")/.."
cruise() { pnpm exec depcruise src scripts --config .dependency-cruiser.cjs --output-type err "$@"; }

fixture=src/components/__layers-fixture.ts
[ ! -e src/components ] && trap 'rm -rf src/components' EXIT || trap 'rm -f "$fixture"' EXIT
mkdir -p src/components
printf "import { migrate } from '../server/migrate.server'\nexport const leak = migrate\n" > "$fixture"
if cruise > /dev/null 2>&1; then echo "::error::layers: the rules missed a component importing *.server.ts. Fix: correct .dependency-cruiser.cjs."; exit 1; fi
rm -f "$fixture"

cruise
echo "layers: scanned $(git ls-files -co --exclude-standard -- 'src/*.ts' 'src/*.tsx' 'scripts/*.ts' | wc -l | tr -d ' ')"
