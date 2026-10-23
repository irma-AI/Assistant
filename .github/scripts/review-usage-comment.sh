#!/usr/bin/env bash
# Renders the review's usage as a PR comment, and with --post creates it or updates the one already there.
# Usage: review-usage-comment.sh USAGE_JSON RUN_URL [--post PR]   (posting needs GH_TOKEN with pull-requests: write)
set -euo pipefail
marker='<!-- ai-review-usage -->'
body=$(jq -r --arg run "$2" --arg marker "$marker" '
  def pretty: sub("^claude-"; "") | (capture("^(?<n>[a-z]+)-(?<v>[0-9-]+)$") | "\(.n[:1] | ascii_upcase)\(.n[1:]) \(.v | gsub("-"; "."))") // .;
  def commas: tostring | if length <= 3 then . else (.[:-3] | commas) + "," + .[-3:] end;
  def usd: if . < 0.01 then "$\(. * 10000 | round / 10000)" else "$\(. * 1000 | round / 1000)" end;
  (if .verdict == "success" then "passed"
   elif .open == null then "failed (no review output)"
   else "failed (\(.open) open P0/P1)" end) as $verdict
  | "\($marker)\n**AI review** · \(.model | pretty) · \($verdict) · \(.turns // "?") turns · \((.ms // 0) / 1000 | round) s\n\n"
  + "| Model | Input | Cache read | Output | Estimate |\n|---|---|---|---|---|\n"
  + ([.models[] | "| \(.name | pretty) | \(.input | commas) | \(.cacheRead | commas) | \(.output | commas) | \(.cost | usd) |"] | join("\n"))
  + "\n\n<sub>Commit \(.sha[:7]) · [run](\($run)) · the estimate is API list price; nothing is charged on the subscription</sub>"
' "$1")
if [ "${3:-}" != --post ]; then printf '%s\n' "$body"; exit 0; fi
pr=$4
ids=$(gh api --paginate "repos/$GITHUB_REPOSITORY/issues/$pr/comments" \
  --jq ".[] | select(.user.login == \"github-actions[bot]\" and (.body | startswith(\"$marker\"))) | .id")
id=${ids%%$'\n'*}
if [ -n "$id" ]; then
  gh api -X PATCH "repos/$GITHUB_REPOSITORY/issues/comments/$id" -f body="$body" --silent
  echo "updated comment $id"
else
  gh api "repos/$GITHUB_REPOSITORY/issues/$pr/comments" -f body="$body" --silent
  echo "posted a usage comment"
fi
