#!/usr/bin/env bash
# Runs audit-gate.sh on made-up `pnpm audit --json` output: a critical advisory must fail, unless excepted or unfixed.
set -euo pipefail
here=$(dirname "$0")
fail=0
# advisory SEVERITY PATCHED: audit output with one advisory.
advisory() {
  jq -n --arg s "$1" --arg p "$2" '{advisories:{"1":{severity:$s, patched_versions:$p, github_advisory_id:"GHSA-aaaa-bbbb-cccc", module_name:"left-pad", vulnerable_versions:"<2.0.0"}}}'
}
expect() { # NAME AUDIT_JSON EXCEPTIONS WANT_EXIT
  ex=$(mktemp); echo "$3" > "$ex"
  set +e; "$here/audit-gate.sh" "$ex" <<<"$2" > /dev/null 2>&1; got=$?; set -e
  rm -f "$ex"
  if [ "$got" = "$4" ]; then echo "ok    $1"; else echo "FAIL  $1: exit $got, want $4"; fail=1; fi
}
expect "critical with a fix fails" "$(advisory critical '>=2.0.0')" '[]' 1
expect "high with a fix fails" "$(advisory high '>=2.0.0')" '[]' 1
expect "moderate passes" "$(advisory moderate '>=2.0.0')" '[]' 0
expect "critical without a fix passes" "$(advisory critical '<0.0.0')" '[]' 0
expect "listed exception passes" "$(advisory critical '>=2.0.0')" '[{"id":"GHSA-aaaa-bbbb-cccc","reason":"test"}]' 0
exit $fail
