#!/usr/bin/env bash
# Fails when a change touches a protected path and its Linear issue doesn't unlock it.
# Usage: protected-paths.sh FILES   (one changed path per line)
# Env: MESSAGE (PR body or squash commit message), LINEAR_API_TOKEN.
set -euo pipefail
here=$(dirname "$0")
files=$1

protected='^(\.github/|\.claude/|\.githooks/|CLAUDE\.md$|rulesets/|Makefile$|mise\.toml$)'
hits=$(grep -E "$protected" "$files" || true)
if [ -z "$hits" ]; then
  echo "scanned $(grep -c . "$files" || true) files, none protected"
  exit 0
fi
echo "protected paths changed:"; echo "$hits"

issue=$(printf '%s' "${MESSAGE:-}" | grep -oiE '\b(closes|fixes|resolves) [A-Z]+-[0-9]+' | head -1 | awk '{print $2}' || true)
if [ -z "$issue" ]; then
  echo "::error::A protected path changed and no Linear issue is closed. Fix: add 'Closes ABC-12' to the PR description, for an issue filed with the ci-change label before it reached Ready."
  exit 1
fi

q='query($id:String!){issue(id:$id){createdAt state{name} labels{nodes{name}} history(first:100){pageInfo{hasNextPage} nodes{createdAt addedLabels{name} fromState{name} toState{name}}}}}'
answer=$(jq -n --arg q "$q" --arg id "$issue" '{query:$q,variables:{id:$id}}' \
  | curl -sSf https://api.linear.app/graphql -H "Authorization: $LINEAR_API_TOKEN" -H 'Content-Type: application/json' -d @-)
verdict=$(printf '%s' "$answer" | jq -r -f "$here/ci-change.jq")
if [ "$verdict" != ok ]; then
  echo "::error::A protected path changed and $issue doesn't unlock it: $verdict. Fix: file a new issue with the ci-change label set before it reaches Ready, and close that one."
  exit 1
fi
echo "$issue unlocks the protected paths"
