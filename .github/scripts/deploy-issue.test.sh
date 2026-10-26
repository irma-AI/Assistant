#!/usr/bin/env bash
# Runs deploy-issue.sh against a fake Linear API: a first failure files an Urgent issue in Ready, a repeat comments,
# and a missing label files nothing.
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
fail=0
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

# The fake curl answers the team query with $tmp/labels and $tmp/open, and records each mutation in $tmp/calls.
mkdir "$tmp/bin"
cat > "$tmp/bin/curl" <<'FAKE'
#!/usr/bin/env bash
req=$(cat)
if jq -e '.query | startswith("{teams")' <<<"$req" > /dev/null; then
  jq -n --argjson open "$(cat "$STATE/open")" --argjson labels "$(cat "$STATE/labels")" \
    '{data:{teams:{nodes:[{id:"team",labels:{nodes:$labels},states:{nodes:[{id:"ready"}]},issues:{nodes:$open}}]}}}'
else
  jq -c '{m: (.query | capture("(?<m>issueCreate|commentCreate)").m)} + .variables.i' <<<"$req" >> "$STATE/calls"
  jq -n --arg m "$(jq -r '.query | capture("(?<m>issueCreate|commentCreate)").m' <<<"$req")" '{data:{($m):{success:true}}}'
fi
FAKE
chmod +x "$tmp/bin/curl"

# expect NAME LABELS OPEN WANT: with these team labels and worked deploy-failure issues, the calls made, as a jq
# array, satisfy the jq test WANT.
expect() {
  echo "$2" > "$tmp/labels"
  echo "$3" > "$tmp/open"
  : > "$tmp/calls"
  PATH="$tmp/bin:$PATH" STATE=$tmp LINEAR_API_TOKEN=t IMAGE=img TAG=abcdef0123 RUN=https://run.test \
    bash "$here/deploy-issue.sh" "failed" > /dev/null 2>&1 || true
  if jq -se "$4" "$tmp/calls" > /dev/null; then echo "ok    $1"
  else echo "FAIL  $1: calls $(cat "$tmp/calls")"; fail=1; fi
}

label='[{"id":"label"}]'
expect "a first failure files an Urgent issue in Ready" "$label" '[]' \
  'length == 1 and .[0].m == "issueCreate" and .[0].priority == 1 and .[0].stateId == "ready"
   and .[0].labelIds == ["label"] and .[0].title == "Deploy failed at abcdef0"'
expect "a repeat while one is worked comments on it" "$label" '[{"id":"open-1"}]' \
  'length == 1 and .[0].m == "commentCreate" and .[0].issueId == "open-1" and (.[0].body | contains("img:abcdef0123 failed"))'
expect "a missing label files nothing" '[]' '[]' 'length == 0'
grep -q 'state:{name:{in:\["Ready","In Progress","In Review"\]}}' "$here/deploy-issue.sh" \
  && echo "ok    only an issue being worked absorbs a repeat" \
  || { echo "FAIL  only an issue being worked absorbs a repeat"; fail=1; }
exit $fail
