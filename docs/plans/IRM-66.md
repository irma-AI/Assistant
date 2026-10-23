# IRM-66: Synthetic data: fix the seed claim, and a check that forces the generator before personal data

No made-up data exists yet. guardrails 2.1 says `make dev` boots the app with seed data, but nothing seeds it, and 2.8's synthetic-data generator is "not built yet". The app stores no personal data today, so the generator is built with the first table that does; the owner wants that guaranteed, so a check enforces it.

Acceptance criteria:
- guardrails 2.1 no longer claims seed data.
- A check in `make check-repo` fails when a migration names a personal-data column (email, phone, name, address, personal number and the like) or creates a table of people while `src/server/synthetic.server.ts` doesn't exist or is a stub, with a fix message pointing at guardrails 2.8; its test has passing and failing cases. The generator's file is a protected path, so a stub can't land without an issue the owner readied.
- guardrails 2.8 says what the generator must do (example domains per RFC 2606, phone numbers in a reserved fiction range, deterministic people for tests, seeds and screenshots) and that the check holds it to the first such migration.

## Progress

- guardrails 2.1: `make dev` boots the app and seeds nothing yet.
- `guards/synthetic-data.sh` fails when a migration, outside its `--` comments, names a personal-data column or creates a people table while `src/server/synthetic.server.ts` doesn't exist or makes no `example.com` address; the fix message points at guardrails 2.8. It runs in `make check-repo` with `guards/synthetic-data.test.sh`: twelve cases, among them an empty stub, a people table with a JSON column, Swedish names and `telemetry` (passes). Today's one migration passes.
- guardrails 2.8 says what the generator must do and that the check holds it to the first such migration.

- Skeptic lens (guards): P1, the word list missed how an ATS names people (`candidate_name`, `surname`, a people table with a JSON column, the Swedish `epost`, `personnr`, `adress`); fixed with suffix words in English and Swedish, whole short words (`tel`, `cell`, `cv`, `dob`) and people tables (`candidate`, `person`, `users`, `applicant`, `contact`, `employee`, `member`, `customer`, `profile` and Swedish forms). P1, an empty file satisfied it; fixed: the generator must make `example.com` addresses, and `src/server/synthetic.server.ts` is now a protected path (`protected-paths.sh`, its test, `CLAUDE.md`, guardrails 2.12), so a stub needs an issue the owner readied with `ci-change`. P2, `--` inside a string literal was stripped as a comment; fixed. Left, and written into 2.8: a people table naming nothing on the list, and a schema made outside `migrations/` (the migration provider only runs `.sql` files there).

## Decisions

- A bare `name` column doesn't trip it on its own: a project or status name isn't personal; in a table of people the table name trips it.
- False hits (`ip_address`, `email_templates`) are accepted: one only means building the generator sooner, which is what the owner wants.
- The fiction phone range is left to the generator's issue to research and cite, rather than written here from memory.

## Next step

Skeptic pass, then open the PR.
