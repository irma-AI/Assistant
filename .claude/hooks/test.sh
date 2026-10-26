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

pr() {
  echo "$2" | bash "$here/draft-pr.sh" > /dev/null 2>&1
  got=$?
  if [ "$got" = "$3" ]; then echo "ok    $1"; else echo "FAIL  $1: exit $got, want $3"; fail=1; fi
}
pr "a draft PR is refused" '{"tool_input": {"title": "x", "draft": true}}' 2
pr "a ready PR is allowed" '{"tool_input": {"title": "x", "draft": false}}' 0
pr "a PR without the flag is allowed" '{"tool_input": {"title": "x"}}' 0

tmp=$(mktemp "${TMPDIR:-/tmp}/format.XXXXXX.ts")
printf 'export const x = { a:1 }\n' > "$tmp"
call "$tmp" | CLAUDE_PROJECT_DIR=$PWD bash "$here/format.sh"
if grep -q '{ a: 1 }' "$tmp"; then echo "ok    an edited file is formatted"; else echo "FAIL  an edited file is formatted: $(cat "$tmp")"; fail=1; fi
rm -f "$tmp"

# check NAME COMMAND PATTERN: COMMAND's output matches PATTERN, or is empty when PATTERN is "".
check() {
  out=$(eval "$2" 2>&1)
  if { [ -z "$3" ] && [ -z "$out" ]; } || { [ -n "$3" ] && grep -q -- "$3" <<<"$out"; }; then echo "ok    $1"
  else echo "FAIL  $1: got '${out:0:120}'"; fail=1; fi
}
cfg=$(mktemp -d "${TMPDIR:-/tmp}/ponytail.XXXXXX")
pt="CLAUDE_CONFIG_DIR=$cfg PONYTAIL_SUBAGENT_MATCHER='^(?!impeccable-)' node $here"
check "a session starts with ponytail's rules" "echo '{}' | CLAUDE_CONFIG_DIR=$cfg node $here/ponytail-activate.js" "PONYTAIL MODE ACTIVE"
check "a subagent gets ponytail's rules" "echo '{\"agent_type\":\"general-purpose\"}' | $pt/ponytail-subagent.js" "PONYTAIL MODE ACTIVE"
check "an impeccable agent does not" "echo '{\"agent_type\":\"impeccable-finish-reviewer\"}' | $pt/ponytail-subagent.js" ""
check "an impeccable task gets the scope" "echo '{\"hook_event_name\":\"PostToolUse\",\"tool_input\":{\"skill\":\"impeccable\"}}' | bash $here/impeccable-scope.sh" "governs code structure only"
check "a typed /impeccable gets the scope" "echo '{\"hook_event_name\":\"UserPromptSubmit\",\"prompt\":\"/impeccable audit\"}' | bash $here/impeccable-scope.sh" "governs code structure only"
check "another skill does not" "echo '{\"hook_event_name\":\"PostToolUse\",\"tool_input\":{\"skill\":\"pr\"}}' | bash $here/impeccable-scope.sh" ""
junk="$cfg/junk" env="$cfg/env" && echo junk > "$junk" && : > "$env"
eng="XDG_CACHE_HOME=$cfg CLAUDE_ENV_FILE=$env IMPECCABLE_ENGINE_URL=file://$junk bash $here/impeccable-engine.sh hook"
check "an engine off its pin is refused" "$eng" "does not match its pin; refused"
check "and is not installed" "find $cfg/impeccable-pinned -type f" ""
check "the launcher is told not to download" "cat $env" "IMPECCABLE_DOWNLOAD_BASE=https://engine-download.invalid"
check "and the agent's calls get a failing engine" "cat $env" "IMPECCABLE_BIN=/.*bin/false"
rm -rf "$cfg"
exit $fail
