#!/bin/bash
# Cloud sessions only. The setup script's work survives as a filesystem snapshot, but nothing it
# started keeps running and its PATH changes don't reach the session, so each session:
# puts mise's tools on PATH, starts PostgreSQL and installs the dependencies from the lockfile.
[ "$CLAUDE_CODE_REMOTE" = true ] || exit 0
cd "$CLAUDE_PROJECT_DIR" || exit 1

tools='export PATH="$HOME/.local/bin:$HOME/.local/share/mise/shims:$PATH"'
eval "$tools"
[ -n "$CLAUDE_ENV_FILE" ] && echo "$tools" >> "$CLAUDE_ENV_FILE"

pg_isready -q -h localhost || service postgresql start > /dev/null || echo "cloud-session: PostgreSQL did not start" >&2
pnpm install --frozen-lockfile --reporter=silent || echo "cloud-session: pnpm install failed" >&2
exit 0
