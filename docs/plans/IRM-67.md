# IRM-67: Seed data with faker and kysely-ctl, and the check that requires it before personal data

Seed data comes from libraries, not a generator of our own (owner decision, 2026-10-23): `@faker-js/faker` makes the values, with `faker.internet.exampleEmail()` for RFC 2606 addresses and a fixed seed for repeatable data, and kysely-ctl's seed files in `seeds/` insert them through Kysely. The synthetic-data check from IRM-66 is re-pointed at that setup, and hardened where the CI review and skeptic lenses found holes.

- The check fails a migration that stores people until `seeds/` holds a seed file that imports `@faker-js/faker` and uses `exampleEmail`. `seeds/` is outside the free paths, so it is protected: any change to people seed data needs an issue the owner readied with `ci-change`. `src/server/synthetic.server.ts` and its protected-path entry go.
- Migrations are read as SQL: across line breaks, repeated spaces and quoted schemas; string literals (backslash escapes only in E'' strings), `--` and `/* */` comments stripped in one pass so whichever starts first wins; dollar-quoted bodies such as `DO $$ ... $$` scanned, not skipped; bytes, not characters, so a file that isn't UTF-8 is still read.
- What counts as people: any `name` or `mail` column; the English and Swedish words from IRM-66 plus German and Dutch name columns (`vorname`, `nachname`, `voornaam`, `achternaam`), matched in either case; people tables including `respondents`, `talent`, `leads`, and temp or unlogged tables. A false hit only means setting up the seeds sooner.
- An empty `migrations/` passes with a count of 0.

Acceptance criteria:
- `guards/synthetic-data.sh` fails a migration that stores people while no file in `seeds/` imports `@faker-js/faker` and calls `exampleEmail`, and passes once one does.
- It reads migrations as SQL as described, including DDL inside a `DO $$ ... $$` block, and an empty `migrations/` passes.
- `guards/synthetic-data.test.sh` covers each case, `src/server/synthetic.server.ts` is no longer a protected-path entry, and guardrails 2.8 describes the faker and kysely-ctl setup and the check.

## Progress

- `guards/synthetic-data.sh` now asks for the seed setup instead of a generator of our own: it fails a migration that stores people while no file in `seeds/` imports `@faker-js/faker` and calls `exampleEmail`. `src/server/synthetic.server.ts` and its protected-path entry are gone; `seeds/` is outside the free paths, so seed changes need `ci-change` (the protected-path test now lists `seeds/0001_people.ts`).
- Reading migrations as SQL, in one perl pass: string literals (backslash escapes only in `E''` strings), `--` and `/* */` comments, whichever starts first; `$$` and `$tag$` delimiters dropped but their bodies kept, so DDL in a `DO` block is scanned; quotes dropped, whitespace collapsed, lower-cased, read as bytes (`LC_ALL=C`, `grep -a`). Upper-case `Ö` is matched explicitly, since byte-wise lower-casing leaves it. Hits from several files print one per line.
- `guards/synthetic-data.test.sh`: 29 cases, among them faker seeds (pass), an empty seed file and one without faker (fail), a people table across lines, with repeated spaces and with a quoted schema, a bare `name`, an apostrophe in a comment, `--` in a block comment, an E-string escape, DDL inside `DO $$`, a plain string ending in a backslash, `FÖRNAMN`, a non-UTF-8 byte, and an empty `migrations/`.
- guardrails 2.1, 2.8 and 2.12 describe faker, kysely-ctl, `seeds/` and the check; `CLAUDE.md` is back to its wording before IRM-66.

## Decisions

- Libraries over our own generator (owner, 2026-10-23): `@faker-js/faker` (9.7M downloads a week, MIT, released 2026-08) for the values and kysely-ctl (the Kysely org's CLI, MIT, released 2026-10) for the seed files. Neither is installed yet; the first issue that adds a table of people adds both, and the check fails until it does.
- `seeds/` stays protected rather than moved under `src/`: every change to people seed data then reaches the owner through `ci-change`, which also keeps a stub seed file from satisfying the check unseen.
- Any `name` or `mail` column counts, and the German and Dutch words came from the skeptic lens; a false hit only means setting up the seeds sooner.
- The first CI review on this PR (before the re-point) found DDL in `DO $$` blocks skipped, backslash escapes taken in plain strings, `FÖRNAMN` unmatched, and hits run together; all fixed here.

## Next step

Push to PR 53 and let the merge queue take it.
