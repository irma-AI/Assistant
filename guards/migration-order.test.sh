#!/usr/bin/env bash
# Runs migration-order.sh on tiny git repositories: a base holding 0001 and 0002, then one case per way to pass or fail.
set -euo pipefail
# A git hook exports GIT_INDEX_FILE and the like; left set, the throwaway repositories would write to the real index.
unset GIT_DIR GIT_INDEX_FILE GIT_WORK_TREE GIT_OBJECT_DIRECTORY GIT_PREFIX
guard=$(cd "$(dirname "$0")" && pwd)/migration-order.sh
fail=0

# expect NAME RESULT FILE...: a branch adding FILEs on top of the base gives RESULT.
expect() {
  name=$1 want=$2; shift 2
  d=$(mktemp -d "${TMPDIR:-/tmp}/migration-order.XXXXXX")
  git -C "$d" init -q -b main && mkdir "$d/migrations"
  touch "$d/migrations/0001_a.sql" "$d/migrations/0002_b.sql" "$d/migrations/0002_c.sql"
  git -C "$d" add -A && git -C "$d" -c user.name=t -c user.email=t@t commit -q -m base
  git -C "$d" update-ref refs/remotes/origin/main HEAD
  for f in "$@"; do touch "$d/migrations/$f"; done
  git -C "$d" add -A
  if "$guard" "$d" > /dev/null 2>&1; then got=pass; else got=fail; fi
  rm -rf "$d"
  if [ "$got" = "$want" ]; then echo "ok    $name"; else echo "FAIL  $name: got $got, want $want"; fail=1; fi
}

expect "unchanged folder" pass
expect "higher number" pass 0003_d.sql
expect "lower number" fail 0001_d.sql
expect "same number as the base's last" fail 0002_d.sql
expect "two added share a number" fail 0003_d.sql 0003_e.sql
expect "two added, both higher" pass 0003_d.sql 0004_e.sql
exit $fail
