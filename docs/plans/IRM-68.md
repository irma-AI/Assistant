# IRM-68: Synthetic-data check: apostrophes in dollar quotes, untested words, faker locales

The CI review on PR 53 found the synthetic-data check still passable and partly untested.

- An apostrophe inside a dollar-quoted string (`comment on table t is $$it's$$;`) threw off the literal stripping, so a people column after it got past the check. Dollar-quoted bodies keep their text for scanning, without their apostrophes.
- The German and Dutch name columns, temp tables, the `respondents`, `talent` and `leads` tables and a bare `mail` column had no test.
- A seed file importing a faker locale entry point (`@faker-js/faker/locale/sv`), or written as `.js` or `.mts`, didn't count as a faker seed.

Acceptance criteria:
- A migration with `$$it's$$` before a people column fails the check, and DDL inside `DO $$ ... $$` still does.
- `guards/synthetic-data.test.sh` covers the German and Dutch columns, a temp table, `respondents`, `talent`, `leads` and a bare `mail` column.
- A seed file importing `@faker-js/faker/locale/sv`, as `.ts`, `.mts` or `.js`, counts as a faker seed.

## Progress

- `guards/synthetic-data.sh`: a dollar-quoted body is replaced by its text without apostrophes before literals and comments are stripped, so `$$it's$$` no longer opens a "literal" that hides the next column, and DDL in `DO $$` is still scanned. A faker seed may import `@faker-js/faker` or an entry point under it (`/locale/sv`), from `seeds/*.ts`, `*.mts` or `*.js`.
- `guards/synthetic-data.test.sh`: 35 cases, adding `$$it's$$` before a people column, German and Dutch names, a temp `respondents` table, `talent` and `leads`, a bare `mail` column, and a locale-entry seed in `.mts` (passes).

## Decisions

- Apostrophes are removed from dollar-quoted bodies rather than the bodies blanked: blanking skipped DDL in `DO` blocks, which the review on PR 53 found.

## Next step

Open the PR.
