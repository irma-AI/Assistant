#!/usr/bin/env bash
# Agent documents: every rule in CLAUDE.md names a check that exists, every path and make target
# an agent document names exists, and each document stays within its character budget.
# Usage: docs.sh [ROOT]
set -euo pipefail
root=${1:-.}
cd "$root"
# Each agent document and its character budget; a missing optional one is skipped.
docs="CLAUDE.md:4000 .claude/skills/next-step/SKILL.md:6000"
fail=0 scanned=0
bad() { echo "::error::docs: $1"; fail=1; }

files=()
for d in $docs; do
  f=${d%:*} budget=${d##*:}
  [ -e "$f" ] || { [ "$f" = CLAUDE.md ] && bad "CLAUDE.md is missing. Fix: restore it."; continue; }
  files+=("$f")
  chars=$(wc -m < "$f" | tr -d ' ')
  [ "$chars" -le "$budget" ] || bad "$f has $chars characters, over its $budget budget. Fix: move detail behind a pointer or cut it."
done
[ ${#files[@]} -gt 0 ] || exit 1

# Every bullet under "## Rules" names its check.
while IFS= read -r line; do
  scanned=$((scanned + 1))
  case $line in *"[enforced: "*) ;; *) bad "a rule names no check: \"${line:0:60}\". Fix: end it with [enforced: guard:ID], [enforced: path:FILE] or [enforced: make:TARGET], or delete it.";; esac
done < <(awk '/^## /{on=($0=="## Rules")} on && /^- /' CLAUDE.md)

for ref in $(grep -oE '\[enforced: [a-z]+:[^]]+\]' CLAUDE.md | sed -E 's/\[enforced: (.*)\]/\1/'); do
  scanned=$((scanned + 1))
  kind=${ref%%:*} value=${ref#*:}
  case $kind in
    guard) [ -e "guards/$value.jq" ] || [ -e "guards/$value.sh" ] || bad "no guard $value (guards/$value.jq or .sh). Fix: name an existing guard.";;
    path) [ -e "$value" ] || bad "$value does not exist. Fix: point at the file that enforces the rule.";;
    make) grep -qE "^$value:" Makefile || bad "no make target $value. Fix: name an existing target.";;
    *) bad "unknown check kind $kind in [enforced: $ref]. Fix: use guard, path or make.";;
  esac
done

# Backticked make targets and paths must exist (globs and placeholders are skipped).
for t in $(cat "${files[@]}" | grep -oE '`make [a-z-]+`' | tr -d '`' | awk '{print $2}'); do
  scanned=$((scanned + 1))
  grep -qE "^$t:" Makefile || bad "\`make $t\` is not a make target. Fix: name an existing target."
done
for p in $(cat "${files[@]}" | grep -oE '`[A-Za-z0-9._/-]+`' | tr -d '`' | grep -E '/|\.[a-z]+$' || true); do
  scanned=$((scanned + 1))
  [ -e "${p%/}" ] || bad "\`$p\` does not exist. Fix: correct the path or drop it."
done

echo "docs: scanned $scanned"
[ "$scanned" -gt 0 ] || bad "nothing to scan in CLAUDE.md."
exit $fail
