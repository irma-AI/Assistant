#!/usr/bin/env bash
# After policy fails: closes the PR once policy has failed on four of its commits, the first attempt
# and three fix rounds, because returns drop fast after that. The issue goes back to the owner.
# Env: GH_TOKEN, PR, MESSAGE (the PR description), RUN (this run's link), LINEAR_API_TOKEN
set -euo pipefail
limit=4
failed=0
for sha in $(gh api --paginate "repos/$GITHUB_REPOSITORY/pulls/$PR/commits" --jq '.[].sha'); do
  n=$(gh api "repos/$GITHUB_REPOSITORY/commits/$sha/check-runs?check_name=policy" --jq '[.check_runs[] | select(.conclusion == "failure")] | length')
  [ "$n" -gt 0 ] && failed=$((failed + 1))
done
echo "policy failed on $failed of this PR's commits"
[ "$failed" -ge "$limit" ] || exit 0

reason="policy failed on the first attempt and three fix rounds; the last run is $RUN"
gh pr comment "$PR" --repo "$GITHUB_REPOSITORY" --body "Closing: $reason. The issue is back with the owner to rethink or split."
gh pr close "$PR" --repo "$GITHUB_REPOSITORY"

issue=$(printf '%s' "$MESSAGE" | grep -oiE '\b(closes|fixes|resolves) [A-Z]+-[0-9]+' | head -1 | awk '{print toupper($2)}' || true)
[ -n "$issue" ] || exit 0
gql() { curl -sSf https://api.linear.app/graphql -H "Authorization: $LINEAR_API_TOKEN" -H 'Content-Type: application/json' -d @-; }
ids=$(jq -n --arg id "$issue" '{query:"query($id:String!){issue(id:$id){id team{states{nodes{id name}}}}}",variables:{id:$id}}' | gql \
  | jq -ec '.data.issue | {id, state: ([.team.states.nodes[] | select(.name == "Needs input") | .id][0])}')
jq -n --argjson ids "$ids" --arg body "PR #$PR was closed: $reason. Please rethink or split this issue." \
  '{query:"mutation($i:CommentCreateInput!){commentCreate(input:$i){success}}",variables:{i:{issueId:$ids.id,body:$body}}}' | gql > /dev/null
jq -n --argjson ids "$ids" '{query:"mutation($id:String!,$s:String!){issueUpdate(id:$id,input:{stateId:$s}){success}}",variables:{id:$ids.id,s:$ids.state}}' | gql > /dev/null
echo "closed PR #$PR and moved $issue to Needs input"
