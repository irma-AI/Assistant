# IRM-86: Seed synthetic people with Faker

Description: see the Linear issue (https://linear.app/petters/issue/IRM-86).

## Progress

- Claimed the issue, branched, wrote this plan. No code yet.
- Tried to download Skatteverket's test personal identity numbers (2026-10-24): `www.skatteverket.se` is refused by this routine's egress proxy (curl 403, WebFetch ENOTFOUND).
- The owner's session downloaded the list on 2026-10-24 from Skatteverket's rowstore API (all 43,895 entries, every check digit valid) and committed 300 evenly spaced numbers as `seeds/skatteverket-test-numbers.json`, with the source URL, dataset URL and date in the file.

## Decisions

- The snapshot must be the real published list; generating numbers ourselves would not be Skatteverket's list, so I did not.

## Next step

Add `@faker-js/faker` and `kysely-ctl`, `kysely.config.ts`, the people factory with tests, the `make dev` seed step, the guard fixture test and the guardrails 2.8 edit.
