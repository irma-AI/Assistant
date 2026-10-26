#!/usr/bin/env bash
# Migrations apply in name order and Kysely refuses one that sorts before an applied one, so every
# migration a PR adds needs a number above all on the base branch and no two added share a number.
# Files already on the base are not checked: applied duplicate pairs stay.
# Usage: migration-order.sh [ROOT] [BASE]   (BASE defaults to origin/main)
set -euo pipefail
cd "${1:-.}"
base=${2:-origin/main}
git rev-parse --verify -q "$base^{commit}" > /dev/null || { echo "::error::migration-order: no $base. Fix: git fetch origin main."; exit 1; }
num() { local n=${1##*/}; echo $((10#${n%%_*})); }
max=0
while IFS= read -r f; do
  [ -n "$f" ] && [ "$(num "$f")" -gt "$max" ] && max=$(num "$f")
done < <(git ls-tree --name-only "$base" migrations/ | grep '\.sql$' || true)
fail=0 seen=" "
while IFS= read -r f; do
  [ -n "$f" ] || continue
  n=$(num "$f")
  [ "$n" -gt "$max" ] || { echo "::error::migration-order: $f is numbered $n but $base already has $max. Fix: rename it to ${max}+1."; fail=1; }
  case $seen in *" $n "*) echo "::error::migration-order: $f shares number $n with another added migration. Fix: renumber one."; fail=1;; esac
  seen="$seen$n "
done < <(comm -13 <(git ls-tree --name-only "$base" migrations/ | sort) <(git ls-files migrations | grep '\.sql$' | sort))
exit $fail
