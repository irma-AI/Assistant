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
# input IN_FLIGHT READY PR_BODIES [MAX]: the jq program's input, with max 1 unless given. An in-flight entry is
# "ID[/State][+label...]", In Progress unless a state is given.
input() {
  jq -n --argjson p "$1" --argjson r "$2" --argjson b "$3" --argjson m "${4:-1}" '{max:$m, prs:[$b[] | {body:.}],
    linear:{data:{inFlight:{nodes:[$p[] | (split("+")) as $x | ($x[0] | split("/")) as $i
      | {identifier:$i[0], state:{name:($i[1] // "In Progress")}, labels:{nodes:[$x[1:][] | {name:.}]}}]},
      ready:{pageInfo:{hasNextPage:false}, nodes:$r}}}}'
}

expect() {
  got=$(jq -r -f "$here/intake-pick.jq" <<<"$2" 2>&1) || got="error: ${got##*: }"
  if [ "$got" = "$3" ]; then echo "ok    $1"; else echo "FAIL  $1: got '$got', want '$3'"; fail=1; fi
}

expect "nothing Ready" "$(input '[]' '[]' '[]')" "wait: nothing in Ready qualifies"
expect "one Ready" "$(input '[]' "[$(ready IRM-12 10:00)]" '[]')" "fire IRM-12"
expect "the oldest first" "$(input '[]' "[$(ready IRM-14 11:00), $(ready IRM-13 10:00)]" '[]')" "fire IRM-13"
expect "one in flight" "$(input '["IRM-11"]' "[$(ready IRM-12 10:00)]" '[]')" "wait: IRM-11 in flight"
expect "a session watching its PR In Review" "$(input '["IRM-11/In Review"]' "[$(ready IRM-12 10:00)]" '[]')" "wait: IRM-11 in flight"
expect "another state the query returned doesn't count" "$(input '["IRM-11/Needs input"]' "[$(ready IRM-12 10:00)]" '[]')" "fire IRM-12"
expect "the local worker's issue leaves the cloud slot free" "$(input '["IRM-11+local"]' "[$(ready IRM-12 10:00)]" '[]')" "fire IRM-12"
expect "a cloud issue in flight beside a local one" "$(input '["IRM-10+local", "IRM-11+bug"]' "[$(ready IRM-12 10:00)]" '[]')" "wait: IRM-11 in flight"
expect "closed by an open PR" "$(input '[]' "[$(ready IRM-12 10:00), $(ready IRM-13 11:00)]" '["Fixes #4\n\ncloses irm-12"]')" "fire IRM-13"
expect "a longer ID in a PR" "$(input '[]' "[$(ready IRM-12 10:00)]" '["Closes IRM-123"]')" "fire IRM-12"
expect "blocked by an unfinished issue" "$(input '[]' "[$(ready IRM-12 10:00 started), $(ready IRM-13 11:00)]" '[]')" "fire IRM-13"
expect "blocked by a canceled issue" "$(input '[]' "[$(ready IRM-12 10:00 canceled)]" '[]')" "wait: nothing in Ready qualifies"
expect "its blocker is Done" "$(input '[]' "[$(ready IRM-12 10:00 completed)]" '[]')" "fire IRM-12"
expect "a PR with no body" "$(input '[]' "[$(ready IRM-12 10:00)]" '[null]')" "fire IRM-12"
three="[$(ready IRM-12 10:00), $(ready IRM-13 11:00), $(ready IRM-14 12:00)]"
expect "two free slots of three" "$(input '["IRM-11"]' "$three" '[]' 3)" "fire IRM-12 IRM-13"
expect "one free slot of three" "$(input '["IRM-10", "IRM-11/In Review"]' "$three" '[]' 3)" "fire IRM-12"
expect "three of three in flight" "$(input '["IRM-9", "IRM-10", "IRM-11"]' "$three" '[]' 3)" "wait: IRM-9, IRM-10, IRM-11 in flight"
expect "fewer qualify than slots" "$(input '[]' "[$(ready IRM-12 10:00)]" '[]' 3)" "fire IRM-12"
expect "Linear answered an error" '{"max":1,"prs":[],"linear":{"errors":[{"message":"bad"}]}}' 'error: [{"message":"bad"}]'
expect "more than one page" "$(input '[]' "[$(ready IRM-12 10:00)]" '[]' | jq '.linear.data.ready.pageInfo.hasNextPage=true')" "error: more Ready issues or relations than one page"
# An answered issue: IRM-11 left Needs input at 12:00, and a PR closing it has one commit at the given hour.
answered() {
  jq --arg c "2026-10-23T$2:00:00Z" '.linear.data.inFlight.nodes[0].history.nodes = [{createdAt:"2026-10-23T12:00:00Z", fromState:{name:"Needs input"}, toState:{name:"In Progress"}}]
    | .prs = [{body:"Closes IRM-11", commits:[{committedDate:$c}]}]' <<<"$1"
}
r12="[$(ready IRM-12 10:00)]"
expect "an answered issue with an open PR resumes" "$(answered "$(input '["IRM-11"]' "$r12" '[]')" 11)" "fire IRM-11"
expect "a PR commit after the answer" "$(answered "$(input '["IRM-11"]' "$r12" '[]')" 13)" "wait: IRM-11 in flight"
expect "a local issue is not resumed" "$(answered "$(input '["IRM-11+local"]' "$r12" '[]')" 11)" "fire IRM-12"
expect "resuming ignores a full house" "$(answered "$(input '["IRM-11", "IRM-10"]' "$r12" '[]' 2)" 11)" "fire IRM-11"
expect "a later Needs input round" "$(answered "$(input '["IRM-11"]' "$r12" '[]')" 11 | jq '.linear.data.inFlight.nodes[0].history.nodes[0].fromState.name = "Ready"')" "wait: IRM-11 in flight"

exit $fail
