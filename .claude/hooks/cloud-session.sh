#!/bin/bash
# Cloud sessions only. The setup script's work survives as a filesystem snapshot, but nothing it
# started keeps running and its PATH changes don't reach the session, so each session:
# puts mise's tools on PATH, installs any that are missing from mise.lock, starts PostgreSQL,
# checks DATABASE_URL and installs the dependencies from the lockfile.
[ "$CLAUDE_CODE_REMOTE" = true ] || exit 0
cd "$CLAUDE_PROJECT_DIR" || exit 1
warn() { echo "cloud-session: $1" >&2; }

tools='export PATH="$HOME/.local/bin:$HOME/.local/share/mise/shims:$PATH"'
eval "$tools"
[ -n "$CLAUDE_ENV_FILE" ] && echo "$tools" >> "$CLAUDE_ENV_FILE"
MISE_LOCKED=1 mise install --quiet || warn "mise install failed; is mise installed by the setup script?"

pg_isready -q -h localhost || service postgresql start > /dev/null || warn "PostgreSQL did not start"
for _ in $(seq 1 15); do pg_isready -q -h localhost && break; sleep 1; done
psql "$DATABASE_URL" -qc 'select 1' > /dev/null 2>&1 || warn "DATABASE_URL does not accept connections"

pnpm install --frozen-lockfile --reporter=silent || warn "pnpm install failed"
exit 0
