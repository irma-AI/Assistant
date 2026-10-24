# IRM-87: Store users and sessions in Postgres

Full issue text: https://linear.app/petters/issue/IRM-87 (users with `pnr_hmac` only, hashed sessions for web cookie and app bearer, requireSession, logout, seed, PII_HASH_KEY, IRM-53 guard, guardrails §7, 30-day session cleanup).

## Progress

- Claimed the issue; read the code. Nothing built yet.

## Decisions

- Work on the session's designated branch `claude/upbeat-archimedes-h91a9w`, not `irm-87-...`.
- `demo` sessions get the web lifetime (12 hours, absolute) until IRM-91 says otherwise.

## Next step

Write the migration and the failing tests, then `session.server.ts`.
