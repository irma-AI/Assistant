# IRM-87: Store users and sessions in Postgres

Full issue text: https://linear.app/petters/issue/IRM-87 (users with `pnr_hmac` only, hashed sessions for web cookie and app bearer, requireSession, logout, seed, PII_HASH_KEY, IRM-53 guard, guardrails §7, 30-day session cleanup).

## Progress

- Migration 0002 (users, sessions), `session.server.ts` (createSession, requireSession, logout, deleteEndedSessions), `/api/v1/logout`, nitro startup plugin (key check + daily sweep, skipped while prerendering), `seeds/users.ts`, PII_HASH_KEY in vitest and `make dev`, IRM-53 guard + fixtures, guardrails §7.
- Proof: `pnpm exec vitest run` (22 pass, real database), `guards/run.sh --self-test`, tsc, eslint, squawk.

## Decisions

- Work on the session's designated branch `claude/upbeat-archimedes-h91a9w`, not `irm-87-...`.
- `demo` sessions get the web lifetime (12 hours, absolute) until IRM-91 says otherwise.
- The startup plugin skips itself when `TSS_PRERENDERING` is set, because the build starts the production server to prerender /app.
- The records of processing (IRM-99) don't exist in the repo yet; the rows are left as a comment on IRM-99.

## Next step

`make check`, push, open the PR with auto-merge, comment on IRM-99, move IRM-87 to In Review.
