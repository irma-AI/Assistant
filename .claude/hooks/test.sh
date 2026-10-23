#!/bin/bash
# Runs the edit-time hooks on sample tool calls.
set -uo pipefail
here=$(cd "$(dirname "$0")" && pwd)
fail=0
call() { jq -n --arg f "$1" '{tool_name: "Edit", tool_input: {file_path: $f}}'; }
expect() {
  call "$2" | bash "$here/generated-files.sh" > /dev/null 2>&1
  got=$?
  if [ "$got" = "$3" ]; then echo "ok    $1"; else echo "FAIL  $1: exit $got, want $3"; fail=1; fi
}
expect "route tree is refused" "$PWD/src/routeTree.gen.ts" 2
expect "database types are refused" "$PWD/src/server/db.gen.ts" 2
expect "a route is allowed" "$PWD/src/routes/index.tsx" 0
expect "a migration is allowed" "$PWD/migrations/0002_x.sql" 0

tmp=$(mktemp "${TMPDIR:-/tmp}/format.XXXXXX.ts")
printf 'export const x = { a:1 }\n' > "$tmp"
call "$tmp" | CLAUDE_PROJECT_DIR=$PWD bash "$here/format.sh"
if grep -q '{ a: 1 }' "$tmp"; then echo "ok    an edited file is formatted"; else echo "FAIL  an edited file is formatted: $(cat "$tmp")"; fail=1; fi
rm -f "$tmp"
exit $fail
