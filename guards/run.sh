#!/usr/bin/env bash
# Runs every guard. A guard is NAME.jq: it reads a PR context
# ({title, body, files, commits}) and prints {scanned, violations}.
# Usage: run.sh CONTEXT.json   judge one PR (in policy)
#        run.sh --self-test    each guard must pass its "pass" fixtures and fail its "fail" ones
set -euo pipefail
here=$(dirname "$0")
fail=0
for g in "$here"/*.jq; do
  id=$(basename "$g" .jq)
  if [ "${1:-}" = --self-test ]; then
    fx="$here/$id.fixtures.json"
    [ -f "$fx" ] || { echo "FAIL  $id: no $id.fixtures.json"; fail=1; continue; }
    ok=$(jq -c '.pass[]' "$fx" | jq -c -f "$g" | jq -s 'length > 0 and all(.scanned > 0 and (.violations | length) == 0)')
    bad=$(jq -c '.fail[]' "$fx" | jq -c -f "$g" | jq -s 'length > 0 and all(.scanned == 0 or (.violations | length) > 0)')
    if [ "$ok" = true ] && [ "$bad" = true ]; then echo "ok    $id"; else echo "FAIL  $id: pass fixtures ok=$ok, fail fixtures caught=$bad"; fail=1; fi
  else
    out=$(jq -c -f "$g" "$1")
    echo "$id: scanned $(jq .scanned <<<"$out")"
    jq -r '.violations[] | "::error::\(.)"' <<<"$out"
    jq -e '.scanned > 0 and (.violations | length) == 0' <<<"$out" > /dev/null || fail=1
  fi
done
exit $fail
