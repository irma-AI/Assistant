#!/usr/bin/env bash
# Runs intake-pick.jq on Linear and GitHub answers shaped like the ones intake-dispatch.yml gets.
set -euo pipefail
here=$(dirname "$0")
fail=0

# ready ID CREATED [BLOCKER_STATE_TYPE]: a Ready issue, blocked by one in that state type if given.
ready() {
  jq -n --arg id "$1" --arg at "2026-10-23T$2:00.000Z" --arg b "${3:-}" '{identifier:$id, createdAt:$at,
    inverseRelations:{pageInfo:{hasNextPage:false}, nodes:(if $b == "" then [] else
      [{type:"blocks", issue:{identifier:"IRM-1", state:{type:$b}}}, {type:"related", issue:{identifier:"IRM-2", state:{type:"started"}}}] end)}}'
}
# input IN_PROGRESS READY PR_BODIES: the jq program's input, with max 1.
input() {
  jq -n --argjson p "$1" --argjson r "$2" --argjson b "$3" '{max:1, prs:[$b[] | {body:.}],
    linear:{data:{inProgress:{nodes:[$p[] | {identifier:.}]}, ready:{pageInfo:{hasNextPage:false}, nodes:$r}}}}'
}

expect() {
  got=$(jq -r -f "$here/intake-pick.jq" <<<"$2" 2>&1) || got="error: ${got##*: }"
  if [ "$got" = "$3" ]; then echo "ok    $1"; else echo "FAIL  $1: got '$got', want '$3'"; fail=1; fi
}

expect "nothing Ready" "$(input '[]' '[]' '[]')" "wait: nothing in Ready qualifies"
expect "one Ready" "$(input '[]' "[$(ready IRM-12 10:00)]" '[]')" "fire IRM-12"
expect "the oldest first" "$(input '[]' "[$(ready IRM-14 11:00), $(ready IRM-13 10:00)]" '[]')" "fire IRM-13"
expect "one In Progress" "$(input '["IRM-11"]' "[$(ready IRM-12 10:00)]" '[]')" "wait: IRM-11 in progress"
expect "closed by an open PR" "$(input '[]' "[$(ready IRM-12 10:00), $(ready IRM-13 11:00)]" '["Fixes #4\n\ncloses irm-12"]')" "fire IRM-13"
expect "a longer ID in a PR" "$(input '[]' "[$(ready IRM-12 10:00)]" '["Closes IRM-123"]')" "fire IRM-12"
expect "blocked by an unfinished issue" "$(input '[]' "[$(ready IRM-12 10:00 started), $(ready IRM-13 11:00)]" '[]')" "fire IRM-13"
expect "blocked by a canceled issue" "$(input '[]' "[$(ready IRM-12 10:00 canceled)]" '[]')" "wait: nothing in Ready qualifies"
expect "its blocker is Done" "$(input '[]' "[$(ready IRM-12 10:00 completed)]" '[]')" "fire IRM-12"
expect "a PR with no body" "$(input '[]' "[$(ready IRM-12 10:00)]" '[null]')" "fire IRM-12"
expect "Linear answered an error" '{"max":1,"prs":[],"linear":{"errors":[{"message":"bad"}]}}' 'error: [{"message":"bad"}]'
expect "more than one page" "$(input '[]' "[$(ready IRM-12 10:00)]" '[]' | jq '.linear.data.ready.pageInfo.hasNextPage=true')" "error: more Ready issues or relations than one page"

exit $fail
