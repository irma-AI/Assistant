#!/bin/bash
# PostToolUse on Edit and Write: formats the edited file at once, so formatting never fails a commit.
# Fast feedback only: CI checks the formatting again, so any error here is ignored.
file=$(jq -r '.tool_input.file_path // empty')
[ -n "$file" ] && [ -f "$file" ] || exit 0
cd "$CLAUDE_PROJECT_DIR" || exit 0
pnpm exec prettier --write --ignore-unknown --log-level silent "$file" > /dev/null 2>&1
exit 0
