# IRM-97: The app knows its environment, and staging stays out of search engines

Read `APP_ENV` in server code; outside `production`, every page response carries `X-Robots-Tag: noindex` and a robots meta tag in the head; `/version` also reports `env`. `/app` (prerendered) is covered by a Traefik header in IRM-96, out of scope.

Acceptance criteria:
- With `APP_ENV=staging`, the home page response has the header and the meta tag, covered by a test.
- With `APP_ENV=production`, neither is present, covered by a test.
- `/version` returns `env` alongside `version`, and the existing smoke test still passes.

## Progress

- `src/api/noindex.ts` (`withNoindex`) is applied by the request middleware in `src/start.ts` to non-API, non-`/version` responses; `/version` returns `env`.
- `make check` passes: `src/api/noindex.test.ts` covers staging, unset and production; e2e covers `/version` and `/` locally.

## Decisions

- The meta tag is injected into the first streamed chunk, since a route `head()` also runs in the browser, where `APP_ENV` is unreadable and no server function is allowed.

## Next step

Open the PR with auto-merge on.
