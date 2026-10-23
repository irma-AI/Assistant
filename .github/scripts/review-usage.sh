#!/usr/bin/env bash
# Reads claude-code-action's execution file and prints the review's usage as one line of JSON.
# Usage: review-usage.sh EXECUTION_FILE MODEL VERDICT SHA [STRUCTURED_OUTPUT]
#   VERDICT is the verdict step's outcome (success or failure).
set -euo pipefail
open=$(jq '[.findings[]? | select(.severity == "P0" or .severity == "P1")] | length' <<<"${5:-}" 2>/dev/null || echo null)
jq -c --arg model "$2" --arg verdict "$3" --arg sha "$4" --argjson open "${open:-null}" '
  (if type == "array" then ([.[] | select(.type? == "result")] | last) else . end) as $r
  | { model: $model, verdict: $verdict, open: $open, sha: $sha,
      turns: $r.num_turns, ms: $r.duration_ms, cost: $r.total_cost_usd,
      models: ($r.modelUsage // {} | to_entries | map({
        name: .key, input: (.value.inputTokens // 0), cacheRead: (.value.cacheReadInputTokens // 0),
        output: (.value.outputTokens // 0), cost: (.value.costUSD // 0) })) }' "$1"
