# IRM-80: Add a versioned /api/v1 for apps and web, with CORS and bearer auth

The issue text lives in Linear (IRM-80); scope: request middleware for CORS on `/api/*`, `requireSession` that rejects everything until IRM-87, `GET /api/v1/me`, `src/api/` schemas and client, HTTPS Playwright server, cross-origin e2e spec.

## Progress

- `src/api/cors.ts` (pure, so `src/start.ts` may import it under guard:layers), `src/start.ts`, `src/server/session.server.ts`, `src/routes/api/v1/me.ts`, `src/api/{schemas,client}.ts`, Zod 4 added.
- Proof: `pnpm exec vitest run`; `pnpm e2e` (fake https://localhost page fetches `/api/v1/me`, gets 401).
- Playwright config serves HTTPS with a throwaway openssl cert; ci `e2e` job installs openssl if missing.

## Decisions

- CORS logic lives in `src/api/` rather than `src/server/`: `src/start.ts` may not import `src/server/`.
- `requireSession` does not read the token yet; it rejects every request, as decided.

## Next step

Open the PR with auto-merge on.
