#!/usr/bin/env bash
# Renders the usage comment from fixture execution files and checks its lines.
set -euo pipefail
here=$(dirname "$0")
tmp=$(mktemp -d "${TMPDIR:-/tmp}/usage.XXXXXX")
trap 'rm -rf "$tmp"' EXIT
fail=0

# expect NAME EXECUTION_FILE VERDICT STRUCTURED_OUTPUT LINE: the rendered comment contains LINE.
expect() {
  "$here/review-usage.sh" "$2" claude-opus-5-5 "$3" 7ee3f2a0123 "$4" > "$tmp/usage.json"
  if "$here/review-usage-comment.sh" "$tmp/usage.json" https://example.com/run | grep -xF -- "$5" > /dev/null; then
    echo "ok    $1"
  else
    echo "FAIL  $1: no line '$5'"; fail=1
  fi
}

ex="$here/fixtures/execution.json"
expect "marker first" "$ex" success '{"findings":[]}' '<!-- ai-review-usage -->'
expect "passed" "$ex" success '{"findings":[]}' '**AI review** · Opus 5.5 · passed · 8 turns · 32 s'
expect "failed with findings" "$ex" failure '{"findings":[{"severity":"P1"},{"severity":"P3"}]}' '**AI review** · Opus 5.5 · failed (1 open P0/P1) · 8 turns · 32 s'
expect "failed without output" "$ex" failure '' '**AI review** · Opus 5.5 · failed (no review output) · 8 turns · 32 s'
expect "model row with commas" "$ex" success '' '| Sonnet 5.5 | 8 | 104,224 | 2,989 | $0.082 |'
expect "small cost" "$ex" success '' '| Haiku 5.5 | 1,729 | 0 | 19 | $0.0002 |'
expect "commit and run" "$ex" success '' '<sub>Commit 7ee3f2a · [run](https://example.com/run) · the estimate is API list price; nothing is charged on the subscription</sub>'

jq '.[2] | .modelUsage["claude-opus-5-5"] = {"inputTokens": 1234567, "outputTokens": 1000, "cacheReadInputTokens": 0, "costUSD": 1.5}' "$ex" > "$tmp/object.json"
expect "single result object" "$tmp/object.json" success '' '| Opus 5.5 | 1,234,567 | 0 | 1,000 | $1.5 |'
jq '.[2].modelUsage = {"claude-sonnet-5-5-20260901": {"outputTokens": 1}, "claude-opus-5-5[1m]": {"outputTokens": 1}}' "$ex" > "$tmp/suffixes.json"
expect "date suffix dropped" "$tmp/suffixes.json" success '' '| Sonnet 5.5 | 0 | 0 | 1 | $0 |'
expect "context suffix dropped" "$tmp/suffixes.json" success '' '| Opus 5.5 | 0 | 0 | 1 | $0 |'
echo '[{"type": "system", "subtype": "init"}]' > "$tmp/crashed.json"
expect "no result message" "$tmp/crashed.json" failure '' '**AI review** · Opus 5.5 · failed (no review output) · ? turns · 0 s'

exit "$fail"
