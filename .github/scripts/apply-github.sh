#!/usr/bin/env bash
# Applies the repository's GitHub settings from this checkout. Needs an admin's gh login.
# Usage: apply-github.sh OWNER/REPO
set -euo pipefail
repo=$1

# Squash only, with the PR title and description as the commit message, and auto-merge.
gh api -X PATCH "repos/$repo" --silent \
  -F allow_squash_merge=true -F allow_merge_commit=false -F allow_rebase_merge=false \
  -F allow_auto_merge=true -F delete_branch_on_merge=true \
  -f squash_merge_commit_title=PR_TITLE -f squash_merge_commit_message=PR_BODY

# Secrets live in "checks", which only main may deploy to.
gh api -X PUT "repos/$repo/environments/checks" --silent --input - <<'EOF'
{"deployment_branch_policy": {"protected_branches": false, "custom_branch_policies": true}}
EOF
gh api "repos/$repo/environments/checks/deployment-branch-policies" --jq '.branch_policies[].name' | grep -qx main \
  || gh api -X POST "repos/$repo/environments/checks/deployment-branch-policies" --silent -f name=main -f type=branch

# Rulesets: update the one with the same name, or create it.
for f in "$(dirname "$0")"/../../rulesets/*.json; do
  name=$(jq -r .name "$f")
  id=$(gh api "repos/$repo/rulesets" --jq ".[] | select(.name==\"$name\") | .id")
  if [ -n "$id" ]; then
    gh api -X PUT "repos/$repo/rulesets/$id" --silent --input "$f"
  else
    gh api -X POST "repos/$repo/rulesets" --silent --input "$f"
  fi
  echo "ruleset $name applied"
done
