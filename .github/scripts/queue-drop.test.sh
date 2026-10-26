#!/usr/bin/env bash
# Runs queue-drop.sh against a fake gh and Linear API: a dropped PR whose issue is In Review goes back to Ready with the
# failed check named; an issue in another state, or a PR without Closes, changes nothing.
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
fail=0
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

mkdir "$tmp/bin"
cat > "$tmp/bin/gh" <<'FAKE'
#!/usr/bin/env bash
# Applies the --jq filter to canned runs and jobs.
case "$2" in
  *actions/runs\?*) data='{"workflow_runs":[{"id":6,"head_branch":"gh-readonly-queue/main/pr-12-abc"},{"id":7,"head_branch":"gh-readonly-queue/main/pr-12-abc"},{"id":5,"head_branch":"gh-readonly-queue/main/pr-12-old"},{"id":8,"head_branch":"gh-readonly-queue/main/pr-120-abc"}]}' ;;
  *runs/6/jobs) data='{"jobs":[{"name":"policy","conclusion":"skipped"}]}' ;;
  *runs/7/jobs) data='{"jobs":[{"name":"e2e","conclusion":"failure"},{"name":"lint","conclusion":"success"},{"name":"app","conclusion":"failure"}]}' ;;
  *) data='{"jobs":[{"name":"stale","conclusion":"failure"}]}' ;;
esac
jq -r "${@: -1}" <<<"$data"
FAKE
cat > "$tmp/bin/curl" <<'FAKE'
#!/usr/bin/env bash
req=$(cat)
if jq -e '.query | startswith("query")' <<<"$req" > /dev/null; then
  jq -n --arg s "$(cat "$STATE")" '{data:{issue:{id:"uuid",state:{name:$s},team:{states:{nodes:[{id:"ready"}]}}}}}'
else
  jq -c '.variables' <<<"$req" >> "$STATE.calls"
  echo '{"data":{"commentCreate":{"success":true},"issueUpdate":{"success":true}}}'
fi
FAKE
chmod +x "$tmp/bin/"*

# expect NAME STATE BODY WANT: the calls made, as a jq array, satisfy the jq test WANT.
expect() {
  echo "$2" > "$tmp/state"; : > "$tmp/state.calls"
  PATH="$tmp/bin:$PATH" STATE=$tmp/state LINEAR_API_TOKEN=t GH_TOKEN=t REPO=o/r PR=12 PR_BODY="$3" RUN=https://run.test \
    bash "$here/queue-drop.sh" > /dev/null 2>&1 || true
  if jq -se "$4" "$tmp/state.calls" > /dev/null; then echo "ok    $1"; else echo "FAIL  $1: calls $(cat "$tmp/state.calls")"; fail=1; fi
}

expect "In Review goes to Ready, naming the failed checks" "In Review" $'## X\n\nCloses IRM-5' \
  'length == 1 and .[0].s == "ready" and .[0].id == "uuid" and (.[0].c.body | contains("failed check: e2e, app"))'
expect "an issue in another state is left alone" "Done" "Closes IRM-5" 'length == 0'
expect "a PR without Closes is ignored" "In Review" "no issue" 'length == 0'
exit $fail
