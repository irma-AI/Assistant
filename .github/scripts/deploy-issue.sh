#!/usr/bin/env bash
# Files a deploy failure in Linear as one Urgent deploy-failure issue in Ready, which intake starts and next-step
# diagnoses with diagnosing-bugs. While such an issue is open, a new failure comments on it instead: one incident,
# one issue.
# Usage: deploy-issue.sh WHAT   (what happened, worded to follow "Deploying IMAGE:TAG")
# Env: LINEAR_API_TOKEN, IMAGE, TAG, RUN
set -euo pipefail
gql() { curl -sSf https://api.linear.app/graphql -H "Authorization: $LINEAR_API_TOKEN" -H 'Content-Type: application/json' -d @-; }
q='{teams(filter:{key:{eq:"IRM"}}){nodes{id labels(filter:{name:{eq:"deploy-failure"}}){nodes{id}} states(filter:{name:{eq:"Ready"}}){nodes{id}} issues(first:1,filter:{labels:{name:{eq:"deploy-failure"}},state:{type:{nin:["completed","canceled","duplicate"]}}}){nodes{id}}}}}'
team=$(jq -n --arg q "$q" '{query:$q}' | gql | jq -ec '.data.teams.nodes[0] | select(.states.nodes[0].id)')
body="Deploying $IMAGE:$TAG $1. Run: $RUN"
open=$(jq -r '.issues.nodes[0].id // empty' <<<"$team")
if [ -n "$open" ]; then
  jq -n --arg id "$open" --arg b "$body" \
    '{query:"mutation($i:CommentCreateInput!){commentCreate(input:$i){success}}",variables:{i:{issueId:$id,body:$b}}}' \
    | gql | jq -e '.data.commentCreate.success' > /dev/null
else
  jq -n --argjson t "$team" --arg title "Deploy failed at ${TAG::7}" --arg d "$body" \
    '{query:"mutation($i:IssueCreateInput!){issueCreate(input:$i){success}}",variables:{i:{teamId:$t.id,labelIds:[$t.labels.nodes[].id],stateId:$t.states.nodes[0].id,priority:1,title:$title,description:$d}}}' \
    | gql | jq -e '.data.issueCreate.success' > /dev/null
fi
