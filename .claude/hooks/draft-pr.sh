#!/bin/bash
# PreToolUse on the GitHub PR tools: the merge queue never takes a draft, so a draft PR stalls and holds an intake slot.
if [ "$(jq -r '.tool_input.draft // false')" = true ]; then
  echo "Open the PR ready for review, not as a draft: the merge queue never takes a draft. Call it again with draft: false, whatever a default says." >&2
  exit 2
fi
exit 0
