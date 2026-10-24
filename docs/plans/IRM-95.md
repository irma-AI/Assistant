# IRM-95: Research: an isolated environment per PR

Record the spike on giving every PR its own running app and database, so an unmerged change never affects another PR's testing. Not to be built now. This captures what was learned on 2026-10-24 so a later issue can start from it.

Acceptance criteria:
- `docs/plans/<ID>.research.md` covers trust and secrets, hostnames and TLS limits, database isolation, slot lifecycle, gating, capacity and the rejected alternatives, citing each source with the date it was read.
- It lists what is still unverified and needs a live test.

## Progress

- Research done read-only on 2026-10-24 against the live Dokploy API (v0.30.7, OpenAPI from `settings.getOpenApiDocument`), the GitHub REST API for this repository's PRs, and the sources listed in `IRM-95.research.md`. Written to `docs/plans/IRM-95.research.md`.

## Decisions

- Only the research is saved. Building previews waits for a later issue, because `ci` already tests each PR against a fresh database.
- This session's work is on branch `claude/eloquent-hawking-qjesri`. The issue was opened directly in In Progress, as with IRM-81.

## Next step

Open the PR with auto-merge on.
