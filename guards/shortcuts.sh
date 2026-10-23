#!/usr/bin/env bash
# Every deliberate shortcut in the app's code reads `shortcut: <the limit>, <when to upgrade>`, so the debt
# can be listed and paid down. Only comments count (// # -- /*), so UI text like "Keyboard shortcut:" doesn't.
# Usage: shortcuts.sh [ROOT]
set -euo pipefail
cd "${1:-.}"
git rev-parse --git-dir > /dev/null || { echo "::error::shortcuts: not a git repository"; exit 1; }
comment='(//|#|--|/\*)[[:space:]]*shortcut:'
found=$(git grep -niE "$comment" -- src e2e scripts migrations || true)
bad=$(grep -vE 'shortcut: [^ ,].*,[[:space:]]+[^ ,]' <<<"$found" || true)
if [ -n "$bad" ]; then
  echo "::error::shortcuts: these don't name their limit and when to upgrade:"
  echo "$bad"
  echo "Fix: write it as 'shortcut: <the limit>, <when to upgrade>'."
  exit 1
fi
echo "shortcuts: scanned $(grep -c . <<<"$found" || true)"
