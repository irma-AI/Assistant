#!/usr/bin/env bash
# A PR the merge queue dropped goes back to Ready in Linear, with a comment naming the check that failed in the queue,
# so the next intake run resumes on the open PR. Only an issue in In Review moves; anything else is left alone.
# Env: LINEAR_API_TOKEN, GH_TOKEN, REPO, PR (number), PR_BODY, RUN
set -euo pipefail
gql() { curl -sSf https://api.linear.app/graphql -H "Authorization: $LINEAR_API_TOKEN" -H 'Content-Type: application/json' -d @-; }
id=$(grep -oE 'Closes IRM-[0-9]+' <<<"$PR_BODY" | head -n1 | cut -d' ' -f2 || true)
[ -n "$id" ] || { echo "no Closes IRM-n in the PR description"; exit 0; }
# The queue's run is on a gh-readonly-queue/<base>/pr-<n>-<sha> branch; its failed jobs are the reason.
run=$(gh api "repos/$REPO/actions/runs?event=merge_group&status=failure&per_page=50" \
  --jq "[.workflow_runs[] | select(.head_branch | test(\"/pr-$PR-\"))][0].id // empty")
failed=""
[ -z "$run" ] || failed=$(gh api "repos/$REPO/actions/runs/$run/jobs" --jq '[.jobs[] | select(.conclusion == "failure") | .name] | join(", ")')
body="The merge queue removed PR #$PR; failed check: ${failed:-none found (removed without a failing check)}. Run: $RUN"
q='query($i:String!){issue(id:$i){id state{name} team{states(filter:{name:{eq:"Ready"}}){nodes{id}}}}}'
issue=$(jq -n --arg q "$q" --arg i "$id" '{query:$q,variables:{i:$i}}' | gql | jq -ec '.data.issue')
[ "$(jq -r .state.name <<<"$issue")" = "In Review" ] || { echo "$id is not In Review"; exit 0; }
jq -n --argjson t "$issue" --arg b "$body" \
  '{query:"mutation($c:CommentCreateInput!,$id:String!,$s:String!){commentCreate(input:$c){success} issueUpdate(id:$id,input:{stateId:$s}){success}}",variables:{c:{issueId:$t.id,body:$b},id:$t.id,s:$t.team.states.nodes[0].id}}' \
  | gql | jq -e '.data.commentCreate.success and .data.issueUpdate.success' > /dev/null
echo "$id back in Ready"
