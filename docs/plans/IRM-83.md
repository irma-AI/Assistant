# Split the landing page from a client-only /app

Split the landing page from a client-only /app. Full description and acceptance criteria: Linear IRM-83.

## Progress

- Claimed the issue, wrote the plan.
- `pnpm build` (writes only `.output/public/app/index.html`, no `<h1>`) and `pnpm exec playwright test` (10 pass) prove all four criteria.

## Decisions

- Developing on the session's designated branch, not `irm-83-...`.
- The placeholder screen is plain text like the home page; no DESIGN.md exists, and nothing styled is added, so no design question arises.

## Next step

Open the PR, enable auto-merge.
