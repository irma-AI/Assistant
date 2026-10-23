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

- A cloud session on this branch (2026-10-23) found ast-grep, pnpm and node in `/root/.local/share/mise/shims` at the pinned versions (Node 24.22.1, pnpm 12.15.0), `pg_isready` and `psql "$DATABASE_URL" -c 'select 1'` succeeding, and `make check` passing in 18.2 s, with nobody running a command first.

## Decisions

- `locked` stays out of `mise.toml`, because it also refuses tools from a developer's global mise config; the hook runs `mise install` with `MISE_LOCKED=1` instead, so cloud installs use only the lock.
- The hook installs missing tools itself, waits up to 15 s for PostgreSQL and checks `DATABASE_URL`, after the review on the first push found it relied on the setup script.
- The first two criteria are checked in the next cloud session after merge.

## Next step

Merge.
