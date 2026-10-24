#!/usr/bin/env bash
# Fails when `pnpm audit --json` output (stdin) lists a critical or high advisory that has a fix and is not in
# the exceptions file (JSON array of {"id": "GHSA-...", "reason": "..."}; default .github/vuln-exceptions.json).
# Usage: pnpm audit --json | audit-gate.sh [EXCEPTIONS.json]
set -euo pipefail
ex=${1:-$(dirname "$0")/../vuln-exceptions.json}
bad=$(jq -r --slurpfile ex "$ex" '
  [.advisories[]
   | select(.severity == "critical" or .severity == "high")
   | select(.patched_versions != "<0.0.0")
   | select(.github_advisory_id as $id | $ex[0] | map(.id) | index($id) | not)
   | "\(.severity) \(.github_advisory_id) \(.module_name) \(.vulnerable_versions), fixed in \(.patched_versions)"]
  | .[]')
[ -z "$bad" ] || { sed 's/^/::error::/' <<<"$bad"; exit 1; }
echo "no critical or high advisory with a fix"
