#!/usr/bin/env bash
# Fails when the PR's head repository isn't this repository. Usage: fork-pr.sh HEAD_REPO THIS_REPO
set -euo pipefail
[ "${1:-}" = "${2:?}" ] || { echo "::error::Fork PRs are refused: the head is ${1:-unknown}, not $2. Push a branch to $2 instead."; exit 1; }
