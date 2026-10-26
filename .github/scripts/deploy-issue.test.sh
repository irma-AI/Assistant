#!/usr/bin/env bash
# Runs deploy-issue.sh against a fake Linear API: a first failure files an Urgent issue in Ready, a repeat comments.
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
fail=0
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

# The fake curl answers the team query with $tmp/open's issues and records each mutation's variables in $tmp/calls.
mkdir "$tmp/bin"
cat > "$tmp/bin/curl" <<'FAKE'
#!/usr/bin/env bash
req=$(cat)
if jq -e '.query | startswith("{teams")' <<<"$req" > /dev/null; then
  jq -n --argjson open "$(cat "$STATE/open")" \
    '{data:{teams:{nodes:[{id:"team",labels:{nodes:[{id:"label"}]},states:{nodes:[{id:"ready"}]},issues:{nodes:$open}}]}}}'
else
  jq -c '.variables.i' <<<"$req" >> "$STATE/calls"
  echo '{"data":{"issueCreate":{"success":true},"commentCreate":{"success":true}}}'
fi
FAKE
chmod +x "$tmp/bin/curl"

# expect NAME OPEN WANT: with OPEN as the open deploy-failure issues, the one call made matches the jq test WANT.
expect() {
  echo "$2" > "$tmp/open"
  : > "$tmp/calls"
  PATH="$tmp/bin:$PATH" STATE=$tmp LINEAR_API_TOKEN=t IMAGE=img TAG=abcdef0123 RUN=https://run.test \
    bash "$here/deploy-issue.sh" "failed" > /dev/null 2>&1 || true
  if [ "$(wc -l < "$tmp/calls")" = 1 ] && jq -e "$3" "$tmp/calls" > /dev/null; then echo "ok    $1"
  else echo "FAIL  $1: calls $(cat "$tmp/calls")"; fail=1; fi
}

expect "a first failure files an Urgent issue in Ready" '[]' \
  '.priority == 1 and .stateId == "ready" and .labelIds == ["label"] and .title == "Deploy failed at abcdef0"'
expect "a repeat while one is open comments on it" '[{"id":"open-1"}]' \
  '.issueId == "open-1" and (.body | contains("img:abcdef0123 failed"))'
exit $fail
