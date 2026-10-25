#!/usr/bin/env bash
# The fork-PR refusal: a fixture event payload for each case.
set -euo pipefail
here=$(dirname "$0")
head() { jq -r '.pull_request.head.repo.full_name' "$here/fixtures/$1"; }
"$here/fork-pr.sh" "$(head pr-same-repo.json)" irma-AI/Assistant
if "$here/fork-pr.sh" "$(head pr-fork.json)" irma-AI/Assistant 2>/dev/null; then echo "FAIL fork PR passed"; exit 1; fi
if "$here/fork-pr.sh" "" irma-AI/Assistant 2>/dev/null; then echo "FAIL deleted fork passed"; exit 1; fi
echo "ok    fork-pr"
