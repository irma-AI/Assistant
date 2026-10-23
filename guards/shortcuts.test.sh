#!/usr/bin/env bash
# Runs shortcuts.sh on tiny git repositories: one that must pass, and one per way to fail.
set -euo pipefail
# A git hook exports GIT_INDEX_FILE and the like; left set, the throwaway repositories would write to the real index.
unset GIT_DIR GIT_INDEX_FILE GIT_WORK_TREE GIT_OBJECT_DIRECTORY GIT_PREFIX
guard=$(cd "$(dirname "$0")" && pwd)/shortcuts.sh
fail=0

# expect NAME FILE LINE RESULT: a repository holding LINE in FILE gives RESULT.
expect() {
  d=$(mktemp -d "${TMPDIR:-/tmp}/shortcuts.XXXXXX")
  mkdir -p "$d/$(dirname "$2")" && printf '%s\n' "$3" > "$d/$2"
  git -C "$d" init -q && git -C "$d" add -A
  if "$guard" "$d" > /dev/null 2>&1; then got=pass; else got=fail; fi
  rm -rf "$d"
  if [ "$got" = "$4" ]; then echo "ok    $1"; else echo "FAIL  $1: got $got, want $4"; fail=1; fi
}

expect "limit and upgrade named" src/a.ts "// shortcut: one page of 100, paginate once a team has more" pass
expect "no shortcut at all" src/a.ts "export const a = 1" pass
expect "outside the app's code" docs/a.md "shortcut: whatever" pass
expect "no upgrade named" src/a.ts "// shortcut: one page of 100" fail
expect "empty" e2e/a.spec.ts "// shortcut:" fail
expect "in a migration" migrations/0002_x.sql "-- shortcut: no index yet" fail
expect "a comma inside the limit" src/a.ts "// shortcut: one page of 1,000 rows, paginate past that" pass
expect "two spaces after the comma" src/a.ts "// shortcut: one page,  paginate later" pass
expect "UI text, not a comment" src/a.tsx '<kbd title="Keyboard shortcut: Ctrl+K" />' pass
expect "capitalised in a comment" src/a.ts "// Shortcut: no retry" fail
exit $fail
