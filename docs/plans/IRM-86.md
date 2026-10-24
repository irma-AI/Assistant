# IRM-86: Seed synthetic people with Faker

Description: see the Linear issue (https://linear.app/petters/issue/IRM-86).

## Progress

- Claimed the issue, branched, wrote this plan. No code yet.
- Tried to download Skatteverket's test personal identity numbers (2026-10-24): `www.skatteverket.se` is refused by this routine's egress proxy (curl 403, WebFetch ENOTFOUND).
- The owner's session downloaded the list on 2026-10-24 from Skatteverket's rowstore API (all 43,895 entries, every check digit valid) and committed 300 evenly spaced numbers as `seeds/skatteverket-test-numbers.json`, with the source URL, dataset URL and date in the file.

- Added deps, `kysely.config.ts`, `seeds/people.ts`, `make dev` seed step, guardrails edit, `src/server/people.test.ts` (determinism, snapshot membership, Luhn, guard fixture). Proved with `make check` (all green).

## Decisions

- The snapshot must be the real published list; generating numbers ourselves would not be Skatteverket's list, so I did not.

## Next step

Wait for the PR to merge.
