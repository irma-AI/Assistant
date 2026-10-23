#!/bin/bash
# PreToolUse on Edit and Write: generated files are rebuilt, never edited by hand.
file=$(jq -r '.tool_input.file_path // empty')
case "$file" in
  */src/routeTree.gen.ts | */src/server/db.gen.ts | src/routeTree.gen.ts | src/server/db.gen.ts)
    echo "$file is generated. Change its source instead (src/routes/ or migrations/), then run make generate." >&2
    exit 2
    ;;
esac
exit 0
