# IRM-23: Cloud sessions: tools on PATH, PostgreSQL running, mise.lock

Cloud sessions with the pinned tools and a running database (plan 2.2, 2.12): a cloud-only SessionStart hook puts mise's tools on PATH through CLAUDE_ENV_FILE, starts the preinstalled PostgreSQL 16 and installs dependencies from the lockfile, and a committed mise.lock pins every tool's download URL and checksum so installs need no lookup.

Acceptance criteria:
- In a cloud session, ast-grep, pnpm and node from mise.toml are on PATH, and PostgreSQL accepts connections at DATABASE_URL, without anyone running a command.
- The hook does nothing outside the cloud.
- mise.lock pins URLs and checksums for linux-x64 and macos-arm64, and is a protected path.

## Progress

- The docs (Configure cloud environments) say the setup script's result is a filesystem snapshot that keeps nothing running, and that a SessionStart hook persists variables by appending `export` lines to `CLAUDE_ENV_FILE`. A diagnostic cloud session found `ast-grep` missing from PATH and PostgreSQL not running.
- `.claude/hooks/cloud-session.sh` exits at once without `CLAUDE_CODE_REMOTE=true`; run with it locally, it wrote the PATH line and the tools resolved from it.
- `mise lock --platform linux-x64,macos-arm64` wrote 12 entries; a fresh install into an empty data directory installed all six tools from them.

## Decisions

- `locked` stays out of `mise.toml`, because it also refuses tools from a developer's global mise config; the cloud setup script sets `MISE_LOCKED=1` instead.
- The first two criteria are checked in the next cloud session after merge.

## Next step

Open the PR; after merge, confirm in a cloud session and flip the first criterion.
