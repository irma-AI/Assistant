#!/usr/bin/env bash
# Runs ci-change.jq on issue histories shaped like Linear's, including folded ones.
set -euo pipefail
here=$(dirname "$0")
fail=0

# issue STATE LABELS HISTORY: a Linear answer for an issue created at 10:00.
issue() {
  jq -n --arg s "$1" --argjson l "$2" --argjson h "$3" '{data:{issue:{
    createdAt:"2026-10-22T10:00:00.000Z", state:{name:$s},
    labels:{nodes:[$l[] | {name:.}]},
    history:{pageInfo:{hasNextPage:false}, nodes:$h}}}}'
}
label() { echo "{\"createdAt\":\"2026-10-22T$1.000Z\",\"addedLabels\":[{\"name\":\"ci-change\"}]}"; }
move() { echo "{\"createdAt\":\"2026-10-22T$1.000Z\",\"fromState\":{\"name\":\"$2\"},\"toState\":{\"name\":\"$3\"}}"; }

expect() {
  got=$(jq -r -f "$here/ci-change.jq" <<<"$2")
  if [ "$got" = "$3" ]; then echo "ok    $1"; else echo "FAIL  $1: got '$got', want '$3'"; fail=1; fi
}

after="ci-change was added after it reached Ready"
expect "label and Ready folded into creation" "$(issue Ready '["ci-change"]' '[]')" ok
expect "label before Ready" "$(issue Ready '["ci-change"]' "[$(label 10:20:00), $(move 10:30:00 Todo Ready)]")" ok
expect "label after Ready" "$(issue Ready '["ci-change"]' "[$(move 10:20:00 Todo Ready), $(label 10:30:00)]")" "$after"
expect "created in Ready, label later" "$(issue Ready '["ci-change"]' "[$(label 10:30:00)]")" "$after"
expect "created in Ready and moved on, label later" "$(issue "In Progress" '["ci-change"]' "[$(label 10:30:00), $(move 10:40:00 Ready "In Progress")]")" "$after"
expect "label folded, Ready later" "$(issue Ready '["ci-change"]' "[$(move 10:30:00 Todo Ready)]")" ok
expect "label re-added after Ready" "$(issue Ready '["ci-change"]' "[$(label 10:20:00), $(move 10:30:00 Todo Ready), $(label 10:40:00)]")" "$after"
expect "never reached Ready" "$(issue Todo '["ci-change"]' "[$(label 10:30:00)]")" ok
expect "no label" "$(issue Ready '[]' '[]')" "it has no ci-change label"
expect "unknown issue" '{"data":{"issue":null}}' "the issue was not found"
expect "history too long" "$(issue Ready '["ci-change"]' '[]' | jq '.data.issue.history.pageInfo.hasNextPage=true')" "its history is longer than one page"

exit $fail
