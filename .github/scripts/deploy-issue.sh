#!/usr/bin/env bash
# Opens a deploy-failure issue in Linear, which next-step starts with diagnosing-bugs.
# Usage: deploy-issue.sh WHAT   (what happened, worded to follow "Deploying IMAGE:TAG")
# Env: LINEAR_API_TOKEN, IMAGE, TAG, RUN
set -euo pipefail
gql() { curl -sSf https://api.linear.app/graphql -H "Authorization: $LINEAR_API_TOKEN" -H 'Content-Type: application/json' -d @-; }
ids=$(jq -n '{query:"{teams(filter:{key:{eq:\"IRM\"}}){nodes{id labels(filter:{name:{eq:\"deploy-failure\"}}){nodes{id}}}}}"}' | gql \
  | jq -ec '.data.teams.nodes[0] | {team: .id, labels: [.labels.nodes[].id]}')
jq -n --argjson ids "$ids" --arg title "Deploy failed at ${TAG::7}" --arg d "Deploying $IMAGE:$TAG $1. Run: $RUN" \
  '{query:"mutation($i:IssueCreateInput!){issueCreate(input:$i){success}}",variables:{i:{teamId:$ids.team,labelIds:$ids.labels,title:$title,description:$d}}}' \
  | gql | jq -e '.data.issueCreate.success' > /dev/null
